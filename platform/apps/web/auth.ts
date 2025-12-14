import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "next-auth";



const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";


export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<User | null> {
        console.log("[auth] authorize called with credentials keys:", Object.keys(credentials || {}));
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            }),
            headers: { "Content-Type": "application/json" }
          });

          if (!res.ok) {
            return null;
          }

          const data = await res.json();

          return {
            id: data.id,
            email: data.email,
            name: `${data.firstName} ${data.lastName}`,
            apiToken: data.token,
            platformRole: data.platformRole,
            campgrounds: data.campgrounds || []
          } as any;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error"
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60 // 7 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.apiToken = (user as any).apiToken;
        token.platformRole = (user as any).platformRole;
        token.campgrounds = (user as any).campgrounds;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session as any).apiToken = token.apiToken;
        (session.user as any).platformRole = token.platformRole;
        (session as any).campgrounds = token.campgrounds;
      }
      return session;
    }
  }
});

