import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GuestJwtStrategy extends PassportStrategy(Strategy, 'guest-jwt') {
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const jwtSecret = config?.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'dev-secret-change-me';
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: { sub: string; email: string }) {
        const guest = await this.prisma.guest.findUnique({
            where: { id: payload.sub },
        });

        if (!guest) {
            throw new UnauthorizedException();
        }

        return guest;
    }
}
