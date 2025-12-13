import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
    sub: string;
    email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService
    ) {
        const jwtSecret = config?.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'dev-secret-change-me';
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                memberships: {
                    include: { campground: true }
                }
            }
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException();
        }

        const memberships = user.memberships.map((m) => ({
            id: m.id,
            campgroundId: m.campgroundId,
            role: m.role,
            campground: m.campground ? { id: m.campground.id, name: m.campground.name, slug: (m.campground as any).slug } : undefined,
        }));

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            region: user.region ?? null,
            platformRole: (user as any).platformRole ?? null,
            platformRegion: (user as any).platformRegion ?? null,
            platformActive: (user as any).platformActive ?? true,
            ownershipRoles: user.ownershipRoles ?? [],
            role: memberships[0]?.role ?? null,
            memberships,
        };
    }
}
