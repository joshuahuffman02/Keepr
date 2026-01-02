import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class GuestAuthService {
    private readonly logger = new Logger(GuestAuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly emailService: EmailService,
    ) { }

    async sendMagicLink(email: string) {
        const normalizedEmail = email.toLowerCase().trim();

        // Find guest by email (in Guest model)
        // We might have multiple guests with same email, but for now let's assume we pick the most recent one or require unique email?
        // Actually, the GuestAccount model has unique email.
        // So we first check if a GuestAccount exists.

        let account = await this.prisma.guestAccount.findFirst({
            where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        });

        if (!account) {
            // If no account, check if a Guest profile exists with this email to link to.
            // If multiple exist, we might need a strategy. For now, pick the most recently updated one.
            const guest = await this.prisma.guest.findFirst({
                where: {
                    OR: [
                        { emailNormalized: normalizedEmail },
                        { email: { equals: normalizedEmail, mode: "insensitive" } },
                    ],
                },
                orderBy: { updatedAt: 'desc' },
            });

            if (!guest) {
                // For security, we shouldn't reveal if email exists or not, but for MVP we might just return success.
                // Or we could create a new Guest record? The requirements say "GuestAccount... link to Guest model".
                // If no guest exists, we can't really log them in to see "My Stay".
                // Let's assume for now that if no guest exists, we just pretend to send.
                return { message: 'If an account exists, a magic link has been sent.' };
            }

            // Create GuestAccount linked to this guest
            account = await this.prisma.guestAccount.create({
                data: {
                    email: normalizedEmail,
                    guestId: guest.id,
                },
            });
        }

        // Generate magic link token
        const token = randomBytes(32).toString('hex');
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 15); // 15 min expiry

        await this.prisma.guestAccount.update({
            where: { id: account.id },
            data: {
                magicLinkToken: token,
                tokenExpiry: expiry,
            },
        });

        // Send email with link
        const baseUrl = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE || "http://localhost:3000").replace(/\/+$/, "");
        const link = `${baseUrl}/portal/verify?token=${token}`;
        try {
            await this.emailService.sendEmail({
                to: normalizedEmail,
                subject: "Your guest portal link",
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                        <h2 style="margin: 0 0 12px 0; color: #0f172a;">Access your stay</h2>
                        <p style="margin: 0 0 16px 0; color: #475569;">Tap the button below to open your guest portal and view your reservation details.</p>
                        <a href="${link}" style="display: inline-block; padding: 12px 18px; background: #10b981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Open guest portal</a>
                        <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">This link expires in 15 minutes. If you didn’t request it, you can ignore this email.</p>
                        <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px; word-break: break-all;">If the button doesn’t work, copy and paste this URL: <br/><a href="${link}" style="color: #0ea5e9;">${link}</a></p>
                    </div>
                `
            });
        } catch (err) {
            // Log email failure without exposing the token for security
            this.logger.error(`Failed to send magic link email to ${normalizedEmail}. Token: ${token.substring(0, 8)}... (redacted)`, err instanceof Error ? err.stack : String(err));
        }

        return { message: 'Magic link sent' };
    }

    async verifyToken(token: string) {
        const account = await this.prisma.guestAccount.findUnique({
            where: { magicLinkToken: token },
            include: { guest: true },
        });

        if (!account || !account.tokenExpiry || account.tokenExpiry < new Date()) {
            throw new UnauthorizedException('Invalid or expired token');
        }

        // Clear token
        await this.prisma.guestAccount.update({
            where: { id: account.id },
            data: {
                magicLinkToken: null,
                tokenExpiry: null,
            },
        });

        // Generate JWT
        const jwt = this.jwtService.sign({
            sub: account.guestId,
            email: account.email,
        });

        return {
            token: jwt,
            guest: {
                id: account.guest.id,
                firstName: account.guest.primaryFirstName,
                lastName: account.guest.primaryLastName,
                email: account.guest.email,
            },
        };
    }

    async getMe(guestId: string) {
        const guest = await this.prisma.guest.findUnique({
            where: { id: guestId },
            include: {
                reservations: {
                    include: {
                        campground: {
                            select: {
                                name: true,
                                slug: true,
                                heroImageUrl: true,
                                amenities: true,
                                checkInTime: true,
                                checkOutTime: true,
                            },
                        },
                        site: true,
                    },
                    orderBy: { arrivalDate: 'desc' },
                },
            },
        });

        if (!guest) {
            throw new NotFoundException('Guest not found');
        }

        return guest;
    }
}
