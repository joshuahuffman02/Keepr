import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Response,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { GuestAuthService } from "./guest-auth.service";
import { AuthGuard } from "@nestjs/passport";
import { Response as ExpressResponse } from "express";
import type { Request } from "express";

@Controller("guest-auth")
export class GuestAuthController {
  constructor(private readonly guestAuthService: GuestAuthService) {}

  @Post("magic-link")
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 per 5 minutes per IP - prevents email spam
  async sendMagicLink(@Body("email") email: string) {
    return this.guestAuthService.sendMagicLink(email);
  }

  @Post("verify")
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute - prevents brute force
  async verifyToken(
    @Body("token") token: string,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.guestAuthService.verifyToken(token);

    // SECURITY: Set httpOnly cookie for secure token storage
    // This prevents XSS attacks from stealing the token
    if (result.token) {
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("guest_token", result.token, {
        httpOnly: true, // Not accessible via JavaScript
        secure: isProduction, // HTTPS only in production
        sameSite: "lax", // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });
    }

    return result;
  }

  @Get("me")
  @UseGuards(AuthGuard("guest-jwt"))
  async getMe(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return this.guestAuthService.getMe(req.user.id);
  }
}
