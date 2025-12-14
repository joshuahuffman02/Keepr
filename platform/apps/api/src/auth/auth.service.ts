import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) { }

    async register(dto: RegisterDto) {
        // Check if user already exists
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() }
        });

        if (existing) {
            throw new ConflictException('Email already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(dto.password, 12);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase(),
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

    async login(dto: LoginDto) {
        try {
            console.log(`[AuthService] Attempting login for ${dto.email}`);
            const user = await this.prisma.user.findUnique({
                where: { email: dto.email.toLowerCase() },
                include: {
                    memberships: {
                        include: { campground: { select: { id: true, name: true, slug: true } } }
                    }
                }
            });

            if (!user) {
                console.log(`[AuthService] User not found: ${dto.email}`);
                throw new UnauthorizedException('Invalid credentials');
            }

            if (!user.isActive) {
                console.log(`[AuthService] User not active: ${dto.email}`);
                throw new UnauthorizedException('Invalid credentials');
            }

            console.log(`[AuthService] User found, comparing password hash for ${user.id}`);
            const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
            if (!passwordValid) {
                console.log(`[AuthService] Invalid password for ${dto.email}`);
                throw new UnauthorizedException('Invalid credentials');
            }

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
            console.error(`[AuthService] Login error for ${dto.email}:`, error);
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
