import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "next-auth";
import { API_BASE } from "@/lib/api-config";

interface Campground {
  id: string;
  name: string;
}

interface LoginResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  platformRole?: string;
  campgrounds?: Campground[];
}

interface ExtendedUser extends User {
  apiToken: string;
  platformRole?: string;
  campgrounds?: Campground[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const isCampground = (value: unknown): value is Campground =>
  isRecord(value) && typeof value.id === "string" && typeof value.name === "string";

const parseCampgrounds = (value: unknown): Campground[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isCampground);
};

const parseLoginResponse = (value: unknown): LoginResponse | null => {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const email = getString(value.email);
  const firstName = getString(value.firstName);
  const lastName = getString(value.lastName);
  const token = getString(value.token);
  if (!id || !email || !firstName || !lastName || !token) return null;
  return {
    id,
    email,
    firstName,
    lastName,
    token,
    platformRole: getString(value.platformRole),
    campgrounds: parseCampgrounds(value.campgrounds),
  };
};

const isExtendedUser = (value: User): value is ExtendedUser =>
  isRecord(value) && typeof value.apiToken === "string";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        console.log(
          "[auth] authorize called with credentials keys:",
          Object.keys(credentials || {}),
        );
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) {
          console.warn("[auth] missing credentials", {
            hasEmail: Boolean(email),
            hasPassword: Boolean(password),
            apiBase: API_BASE,
          });
          return null;
        }

        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            body: JSON.stringify({
              email,
              password,
            }),
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            cache: "no-store",
          });

          if (!res.ok) {
            let bodyText = "";
            try {
              bodyText = await res.text();
            } catch {
              // ignore body parse errors
            }
            console.warn("[auth] login failed", {
              status: res.status,
              apiBase: API_BASE,
              body: bodyText?.slice(0, 500),
            });
            return null;
          }

          let data: LoginResponse | null;
          try {
            const rawData: unknown = await res.json();
            data = parseLoginResponse(rawData);
          } catch {
            console.warn("[auth] login response not json", { apiBase: API_BASE });
            return null;
          }
          if (!data?.token) {
            console.warn("[auth] login response missing token", { apiBase: API_BASE });
            return null;
          }

          const user: ExtendedUser = {
            id: data.id,
            email: data.email,
            name: `${data.firstName} ${data.lastName}`,
            apiToken: data.token,
            platformRole: data.platformRole,
            campgrounds: data.campgrounds || [],
          };
          return user;
        } catch (error) {
          console.error("Auth error:", error, { apiBase: API_BASE });
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user && isExtendedUser(user)) {
        if (typeof user.id === "string") {
          token.id = user.id;
        }
        token.apiToken = user.apiToken;
        token.platformRole = user.platformRole;
        token.campgrounds = user.campgrounds;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.id === "string") {
          session.user.id = token.id;
        }
        if (typeof token.apiToken === "string") {
          Object.assign(session, {
            apiToken: token.apiToken,
            campgrounds: token.campgrounds,
          });
        }
        if (typeof token.platformRole === "string") {
          Object.assign(session.user, {
            platformRole: token.platformRole,
          });
        }
      }
      return session;
    },
  },
});
