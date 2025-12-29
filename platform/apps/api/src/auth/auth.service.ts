import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
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
    private readonly logger = new Logger(AuthService.name);

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

            this.logger.log(`Attempting login for ${normalizedEmail}`);
            let user = await this.prisma.user.findUnique({
                where: { email: normalizedEmail },
                include: {
                    memberships: {
                        include: { campground: { select: { id: true, name: true, slug: true } } }
                    }
                }
            });

            if (!user) {
                // SECURITY: Bootstrap admin creation is disabled by default in production
                // Must explicitly set ALLOW_BOOTSTRAP_ADMIN=true to enable
                const isProduction = process.env.NODE_ENV === "production";
                const allowBootstrap = !isProduction || process.env.ALLOW_BOOTSTRAP_ADMIN === "true";

                // Only check for active users if bootstrap is allowed
                const activeUsers = allowBootstrap
                    ? await this.prisma.user.count({ where: { isActive: true } })
                    : 1; // Pretend there are users to skip bootstrap

                if (activeUsers === 0 && allowBootstrap) {
                    // SECURITY: Validate password strength for bootstrap admin
                    if (dto.password.length < 12) {
                        throw new UnauthorizedException('Bootstrap admin password must be at least 12 characters');
                    }
                    if (!/[A-Z]/.test(dto.password) || !/[a-z]/.test(dto.password) || !/[0-9]/.test(dto.password)) {
                        throw new UnauthorizedException('Bootstrap admin password must contain uppercase, lowercase, and numbers');
                    }

                    this.logger.warn(`SECURITY: Bootstrapping first admin user: ${normalizedEmail}`);
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

                    // Log security event for bootstrap admin creation
                    await this.securityEvents.logEvent({
                        type: SecurityEventType.ADMIN_ACTION,
                        severity: SecurityEventSeverity.HIGH,
                        ipAddress,
                        userAgent,
                        userId: user.id,
                        details: {
                            action: "bootstrap_admin_created",
                            email: normalizedEmail,
                            warning: "First platform admin created via bootstrap"
                        },
                    });
                } else {
                    this.logger.log(`User not found: ${normalizedEmail}`);
                    // Record failed attempt even for non-existent users (prevents enumeration)
                    this.accountLockout.handleFailedLogin(normalizedEmail);
                    await this.securityEvents.logLoginAttempt(false, normalizedEmail, ipAddress, userAgent, undefined, "user_not_found");
                    throw new UnauthorizedException('Invalid credentials');
                }
            }

            if (!user.isActive) {
                this.logger.log(`User not active: ${normalizedEmail}`);
                this.accountLockout.handleFailedLogin(normalizedEmail);
                await this.securityEvents.logLoginAttempt(false, normalizedEmail, ipAddress, userAgent, user.id, "user_inactive");
                throw new UnauthorizedException('Invalid credentials');
            }

            this.logger.log(`User found, comparing password hash for ${user.id}`);
            const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
            if (!passwordValid) {
                this.logger.log(`Invalid password for ${normalizedEmail}`);
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

            this.logger.log(`Password valid, generating token`);
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
            this.logger.error(`Login error for ${normalizedEmail}:`, error instanceof Error ? error.stack : error);
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
