import type { AuthUser } from "../auth/auth.types";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    campgroundId?: string | null;
    organizationId?: string | null;
  }
}
