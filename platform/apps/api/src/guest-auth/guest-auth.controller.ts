import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GuestAuthService } from './guest-auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('guest-auth')
export class GuestAuthController {
    constructor(private readonly guestAuthService: GuestAuthService) { }

    @Post('magic-link')
    @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 per 5 minutes per IP - prevents email spam
    async sendMagicLink(@Body('email') email: string) {
        return this.guestAuthService.sendMagicLink(email);
    }

    @Post('verify')
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute - prevents brute force
    async verifyToken(@Body('token') token: string) {
        return this.guestAuthService.verifyToken(token);
    }

    @Get('me')
    @UseGuards(AuthGuard('guest-jwt'))
    async getMe(@Request() req: any) {
        return this.guestAuthService.getMe(req.user.id);
    }
}
