import { Controller, Post, Body, Get, UseGuards, Request, Headers, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    login(
        @Body() dto: LoginDto,
        @Req() req: any,
        @Headers('user-agent') userAgent: string,
        @Headers('x-forwarded-for') forwardedFor?: string
    ) {
        // Use forwarded IP if behind proxy, otherwise use direct IP
        const clientIp = forwardedFor?.split(',')[0]?.trim() || req.ip;
        return this.authService.login(dto, clientIp, userAgent);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getProfile(@Request() req: any) {
        return this.authService.getProfile(req.user.id);
    }

  @Post('invitations/accept')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }
}
