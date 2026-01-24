import { DefaultSession } from "next-auth";

interface CampgroundMembership {
  id: string;
  name: string;
  slug: string;
  role: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    apiToken?: string;
    campgrounds?: CampgroundMembership[];
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    apiToken?: string;
    campgrounds?: CampgroundMembership[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    apiToken?: string;
    campgrounds?: CampgroundMembership[];
  }
}
