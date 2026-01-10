import { Controller, Post, Body, Get, Delete, Param, UseGuards, Request, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, MobileLoginDto, RefreshTokenDto } from './dto';
import { JwtAuthGuard } from './guards';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { extractClientIpFromRequest } from '../common/ip-utils';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Headers('user-agent') userAgent: string
    ) {
        // Extract and validate client IP to prevent spoofing via x-forwarded-for
        const clientIp = extractClientIpFromRequest(req) || req.ip;
        return this.authService.login(dto, clientIp, userAgent);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getProfile(@Request() req: Request) {
        return this.authService.getProfile(req.user.id);
    }

  @Post('invitations/accept')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  // =========================================================================
  // Mobile Authentication Endpoints
  // =========================================================================

  @Post('mobile/login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  mobileLogin(
    @Body() dto: MobileLoginDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent: string
  ) {
    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const clientIp = extractClientIpFromRequest(req) || req.ip;
    return this.authService.mobileLogin(dto, clientIp, userAgent);
  }

  @Post('mobile/refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent: string
  ) {
    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const clientIp = extractClientIpFromRequest(req) || req.ip;
    return this.authService.refreshMobileToken(dto.refreshToken, clientIp, userAgent);
  }

  @Post('mobile/logout')
  @HttpCode(HttpStatus.OK)
  mobileLogout(@Body() dto: RefreshTokenDto) {
    return this.authService.mobileLogout(dto.refreshToken);
  }

  @Get('mobile/sessions')
  @UseGuards(JwtAuthGuard)
  getMobileSessions(@Request() req: Request) {
    return this.authService.getMobileSessions(req.user.id);
  }

  @Delete('mobile/sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  revokeMobileSession(
    @Request() req: Request,
    @Param('sessionId') sessionId: string
  ) {
    return this.authService.revokeMobileSession(req.user.id, sessionId);
  }
}
