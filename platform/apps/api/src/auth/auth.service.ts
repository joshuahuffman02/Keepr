import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformRole } from '@prisma/client';
import { RegisterDto, LoginDto } from './dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { AccountLockoutService } from '../security/account-lockout.service';
import { SecurityEventsService, SecurityEventType, SecurityEventSeverity } from '../security/security-events.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly accountLockout: AccountLockoutService,
        private readonly securityEvents: SecurityEventsService
    ) { }

    async register(dto: RegisterDto) {
        const normalizedEmail = dto.email.trim().toLowerCase();
        // Check if user already exists
        const existing = await this.prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existing) {
            throw new ConflictException('Email already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(dto.password, 12);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName
            }
        });

        // Generate token
        const token = this.generateToken(user.id, user.email);

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            token
        };
    }

    async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
        const normalizedEmail = dto.email.trim().toLowerCase();

        try {
            // Check if account is locked before attempting login
            const isLocked = this.accountLockout.isLocked(normalizedEmail);
            if (isLocked) {
                await this.securityEvents.logEvent({
                    type: SecurityEventType.LOGIN_BLOCKED,
                    severity: SecurityEventSeverity.WARNING,
                    ipAddress,
                    userAgent,
                    details: { email: normalizedEmail, reason: "account_locked" },
                });
                this.accountLockout.checkAndThrowIfLocked(normalizedEmail);
            }

            console.log(`[AuthService] Attempting login for ${normalizedEmail}`);
            let user = await this.prisma.user.findUnique({
                where: { email: normalizedEmail },
                include: {
                    memberships: {
                        include: { campground: { select: { id: true, name: true, slug: true } } }
                    }
                }
            });

            if (!user) {
                const allowBootstrap = process.env.NODE_ENV !== "production" || process.env.ALLOW_BOOTSTRAP_ADMIN === "true";
                const activeUsers = allowBootstrap
                    ? await this.prisma.user.count({ where: { isActive: true } })
                    : 0;

                if (activeUsers === 0 && allowBootstrap) {
                    console.warn(`[AuthService] Bootstrapping first admin user: ${normalizedEmail}`);
                    const passwordHash = await bcrypt.hash(dto.password, 12);
                    user = await this.prisma.user.create({
                        data: {
                            email: normalizedEmail,
                            passwordHash,
                            firstName: "Admin",
                            lastName: "User",
                            platformRole: PlatformRole.platform_admin,
                            isActive: true,
                            mustChangePassword: true
                        },
                        include: {
                            memberships: {
                                include: { campground: { select: { id: true, name: true, slug: true } } }
                            }
                        }
                    });
                } else {
                    console.log(`[AuthService] User not found: ${normalizedEmail}`);
                    // Record failed attempt even for non-existent users (prevents enumeration)
                    this.accountLockout.handleFailedLogin(normalizedEmail);
                    await this.securityEvents.logLoginAttempt(false, normalizedEmail, ipAddress, userAgent, undefined, "user_not_found");
                    throw new UnauthorizedException('Invalid credentials');
                }
            }

            if (!user.isActive) {
                console.log(`[AuthService] User not active: ${normalizedEmail}`);
                this.accountLockout.handleFailedLogin(normalizedEmail);
                await this.securityEvents.logLoginAttempt(false, normalizedEmail, ipAddress, userAgent, user.id, "user_inactive");
                throw new UnauthorizedException('Invalid credentials');
            }

            console.log(`[AuthService] User found, comparing password hash for ${user.id}`);
            const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
            if (!passwordValid) {
                console.log(`[AuthService] Invalid password for ${normalizedEmail}`);
                // Record failed attempt and check if now locked
                const lockStatus = this.accountLockout.handleFailedLogin(normalizedEmail);
                await this.securityEvents.logLoginAttempt(false, normalizedEmail, ipAddress, userAgent, user.id, "invalid_password");

                // Check if account just got locked
                if (lockStatus.locked) {
                    await this.securityEvents.logAccountLocked(normalizedEmail, ipAddress, lockStatus.attempts);
                }
                throw new UnauthorizedException('Invalid credentials');
            }

            // Successful login - clear any lockout tracking
            this.accountLockout.recordSuccessfulLogin(normalizedEmail);
            await this.securityEvents.logLoginAttempt(true, normalizedEmail, ipAddress, userAgent, user.id);

            console.log(`[AuthService] Password valid, generating token`);
            const token = this.generateToken(user.id, user.email);

            return {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                platformRole: user.platformRole,
                campgrounds: user.memberships.map((m: { campground: { id: string; name: string; slug: string }; role: string }) => ({
                    id: m.campground.id,
                    name: m.campground.name,
                    slug: m.campground.slug,
                    role: m.role
                })),
                token
            };
        } catch (error) {
            console.error(`[AuthService] Login error for ${normalizedEmail}:`, error);
            throw error;
        }
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                memberships: {
                    include: { campground: { select: { id: true, name: true, slug: true } } }
                }
            }
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            campgrounds: user.memberships.map(m => ({
                id: m.campground.id,
                name: m.campground.name,
                slug: m.campground.slug,
                role: m.role
            }))
        };
    }

    private generateToken(userId: string, email: string): string {
        return this.jwtService.sign(
            { sub: userId, email },
            { expiresIn: '7d' }
        );
    }

    async acceptInvite(dto: AcceptInviteDto) {
        const invite = await this.prisma.inviteToken.findUnique({
            where: { token: dto.token },
            include: { user: true }
        });

        if (!invite || invite.redeemedAt) {
            throw new UnauthorizedException("Invalid or already used invite");
        }
        if (invite.expiresAt < new Date()) {
            throw new UnauthorizedException("Invite has expired");
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);

        const user = await this.prisma.user.update({
            where: { id: invite.userId },
            data: {
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                isActive: true
            }
        });

        await this.prisma.inviteToken.update({
            where: { id: invite.id },
            data: { redeemedAt: new Date() }
        });

        const token = this.generateToken(user.id, user.email);

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            token
        };
    }
}
