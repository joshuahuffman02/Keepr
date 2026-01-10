import { Injectable, UnauthorizedException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../auth.types';

export interface JwtPayload {
    sub: string;
    email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService
    ) {
        const jwtSecret = config?.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

        // SECURITY: Never use a default secret - require explicit configuration
        if (!jwtSecret) {
            const isProduction = process.env.NODE_ENV === 'production';
            if (isProduction) {
                throw new InternalServerErrorException('CRITICAL: JWT_SECRET environment variable is required in production');
            }
            // In development, use a random secret (tokens won't persist across restarts)
            const devSecret = `dev-${Date.now()}-${Math.random().toString(36)}`;
            console.warn('[SECURITY] JWT_SECRET not set. Using random secret - tokens will not persist across restarts.');
            super({
                jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
                ignoreExpiration: false,
                secretOrKey: devSecret,
            });
            return;
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: JwtPayload): Promise<AuthUser> {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                CampgroundMembership: {
                    include: { Campground: true }
                }
            }
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException();
        }

        const memberships = user.CampgroundMembership.map((m) => ({
            id: m.id,
            campgroundId: m.campgroundId,
            role: m.role,
            campground: m.Campground ? { id: m.Campground.id, name: m.Campground.name, slug: m.Campground.slug } : undefined,
        }));

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            region: user.region ?? null,
            platformRole: user.platformRole ?? null,
            platformRegion: user.platformRegion ?? null,
            platformActive: user.platformActive ?? true,
            ownershipRoles: user.ownershipRoles ?? [],
            role: memberships[0]?.role ?? null,
            memberships,
        };
    }
}
