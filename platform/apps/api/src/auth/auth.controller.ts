import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  UseGuards,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, MobileLoginDto, RefreshTokenDto } from "./dto";
import { JwtAuthGuard } from "./guards";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { extractClientIpFromRequest } from "../common/ip-utils";
import type { Request as ExpressRequest } from "express";

const requireUserId = (req: ExpressRequest): string => {
  const id = req.user?.id;
  if (!id) {
    throw new UnauthorizedException("User not found");
  }
  return id;
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(
    @Body() dto: LoginDto,
    @Req() req: ExpressRequest,
    @Headers("user-agent") userAgent: string,
  ) {
    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const clientIp = extractClientIpFromRequest(req) || req.ip;
    return this.authService.login(dto, clientIp, userAgent);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: ExpressRequest) {
    return this.authService.getProfile(requireUserId(req));
  }

  @Post("invitations/accept")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  // =========================================================================
  // Mobile Authentication Endpoints
  // =========================================================================

  @Post("mobile/login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  mobileLogin(
    @Body() dto: MobileLoginDto,
    @Req() req: ExpressRequest,
    @Headers("user-agent") userAgent: string,
  ) {
    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const clientIp = extractClientIpFromRequest(req) || req.ip;
    return this.authService.mobileLogin(dto, clientIp, userAgent);
  }

  @Post("mobile/refresh")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: ExpressRequest,
    @Headers("user-agent") userAgent: string,
  ) {
    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const clientIp = extractClientIpFromRequest(req) || req.ip;
    return this.authService.refreshMobileToken(dto.refreshToken, clientIp, userAgent);
  }

  @Post("mobile/logout")
  @HttpCode(HttpStatus.OK)
  mobileLogout(@Body() dto: RefreshTokenDto) {
    return this.authService.mobileLogout(dto.refreshToken);
  }

  @Get("mobile/sessions")
  @UseGuards(JwtAuthGuard)
  getMobileSessions(@Req() req: ExpressRequest) {
    return this.authService.getMobileSessions(requireUserId(req));
  }

  @Delete("mobile/sessions/:sessionId")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  revokeMobileSession(@Req() req: ExpressRequest, @Param("sessionId") sessionId: string) {
    return this.authService.revokeMobileSession(requireUserId(req), sessionId);
  }
}
