import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import { PrismaService } from '../prisma/prisma.service';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    guestId?: string;
    reservationId?: string;
    campgroundId?: string;
}

interface ReceiptLineItem {
    label: string;
    amountCents: number;
}

interface PaymentReceiptOptions {
    guestEmail: string;
    guestName: string;
    campgroundName: string;
    campgroundId?: string;
    guestId?: string;
    amountCents: number;
    paymentMethod?: string;
    transactionId?: string;
    reservationId?: string;
    siteNumber?: string;
    arrivalDate?: Date;
    departureDate?: Date;
    source?: string; // 'online' | 'admin' | 'kiosk' | 'pos'
    lineItems?: ReceiptLineItem[];
    taxCents?: number;
    feeCents?: number;
    totalCents?: number;
    kind?: "payment" | "refund" | "pos";
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter | null = null;
    private postmarkToken: string | null = null;
    private resendApiKey: string | null = null;

    constructor(private readonly prisma: PrismaService) {
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const secure = process.env.SMTP_SECURE === "true";
        this.postmarkToken = process.env.POSTMARK_SERVER_TOKEN || null;
        this.resendApiKey = process.env.RESEND_API_KEY || null;

        if (this.resendApiKey) {
            this.logger.log("EmailService using Resend");
        } else if (host && port && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure,
                auth: { user, pass }
            });
            this.logger.log(`EmailService using SMTP: ${host}:${port} secure=${secure}`);
        } else if (!this.postmarkToken) {
            this.logger.warn("Resend, SMTP, and Postmark not configured; falling back to console logging emails.");
        }
    }

    async sendEmail(options: EmailOptions): Promise<{ providerMessageId?: string; provider?: string; fallback?: string }> {
        // For Resend, use onboarding@resend.dev if no verified domain is configured
        const configuredFrom = process.env.SMTP_FROM || "";
        const isValidEmail = configuredFrom.includes("@");
        const resendFrom = isValidEmail ? configuredFrom : "Camp Everyday <onboarding@resend.dev>";
        const fromEmail = isValidEmail ? configuredFrom : "no-reply@campreserv.com";

        const tryResend = async () => {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.resendApiKey}`
                },
                body: JSON.stringify({
                    from: resendFrom,
                    to: options.to,
                    subject: options.subject,
                    html: options.html
                })
            });
            const data: any = await res.json();
            if (!res.ok) {
                throw new BadRequestException(`Resend send failed: ${res.status} ${JSON.stringify(data)}`);
            }
            this.logger.log(`Email sent via Resend to ${options.to} (${options.subject})`);
            return { providerMessageId: data.id, provider: "resend" };
        };

        const tryPostmark = async () => {
            const res = await fetch("https://api.postmarkapp.com/email", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": this.postmarkToken as string
                },
                body: JSON.stringify({
                    From: fromEmail,
                    To: options.to,
                    Subject: options.subject,
                    HtmlBody: options.html
                })
            });
            const data: any = await res.json();
            if (!res.ok) {
                throw new BadRequestException(`Postmark send failed: ${res.status} ${JSON.stringify(data)}`);
            }
            this.logger.log(`Email sent via Postmark to ${options.to} (${options.subject})`);
            return { providerMessageId: data.MessageID, provider: "postmark" };
        };

        // Prefer Resend, then Postmark, then SMTP, then console log
        if (this.resendApiKey) {
            try {
                return await tryResend();
            } catch (err) {
                this.logger.warn(`Resend send attempt 1 failed, retrying: ${err}`);
                try {
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    return await tryResend();
                } catch (err2) {
                    this.logger.warn(`Resend retry failed, falling back to Postmark/SMTP/console: ${err2}`);
                }
            }
        }

        if (this.postmarkToken) {
            try {
                return await tryPostmark();
            } catch (err) {
                this.logger.warn(`Postmark send attempt 1 failed, retrying: ${err}`);
                try {
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    return await tryPostmark();
                } catch (err2) {
                    this.logger.warn(`Postmark retry failed, falling back to SMTP/console: ${err2}`);
                }
            }
        }

        if (this.transporter) {
            await this.transporter.sendMail({
                from: fromEmail,
                to: options.to,
                subject: options.subject,
                html: options.html
            });
            this.logger.log(`Email sent via SMTP to ${options.to} (${options.subject})`);
            return { provider: "smtp" };
        }

        // Fallback to console log
        this.logger.log(`
================================================================================
SENDING EMAIL (LOG ONLY - configure RESEND_API_KEY, POSTMARK, or SMTP to send)
To: ${options.to}
Subject: ${options.subject}
--------------------------------------------------------------------------------
${options.html}
================================================================================
        `);
        return { provider: "log", fallback: "log_only" };
    }

    /**
     * Send a payment receipt email to the guest
     */
    async sendPaymentReceipt(options: PaymentReceiptOptions): Promise<void> {
        const sign = options.kind === "refund" ? -1 : 1;
        const amountDisplayCents = (options.totalCents ?? options.amountCents) * sign;
        const formattedAmount = `$${(amountDisplayCents / 100).toFixed(2)}`;
        const transactionDate = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        const lineItems = options.lineItems ?? [];
        const hasLines = lineItems.length > 0 || options.taxCents !== undefined || options.feeCents !== undefined;
        const totalCents = options.totalCents ?? (lineItems.length
            ? lineItems.reduce((sum, i) => sum + i.amountCents, 0) + (options.taxCents ?? 0) + (options.feeCents ?? 0)
            : options.amountCents);

        const linesTable = hasLines ? `
            <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                <thead>
                    <tr>
                        <th style="text-align: left; padding: 6px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Item</th>
                        <th style="text-align: right; padding: 6px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineItems.map((li) => `
                        <tr>
                            <td style="padding: 6px 0; color: #0f172a;">${li.label}</td>
                            <td style="padding: 6px 0; color: #0f172a; text-align: right;">$${((li.amountCents * sign) / 100).toFixed(2)}</td>
                        </tr>
                    `).join("")}
                    ${options.taxCents !== undefined ? `
                        <tr>
                            <td style="padding: 6px 0; color: #0f172a;">Tax</td>
                            <td style="padding: 6px 0; color: #0f172a; text-align: right;">$${((options.taxCents * sign) / 100).toFixed(2)}</td>
                        </tr>
                    ` : ""}
                    ${options.feeCents !== undefined ? `
                        <tr>
                            <td style="padding: 6px 0; color: #0f172a;">Fees</td>
                            <td style="padding: 6px 0; color: #0f172a; text-align: right;">$${((options.feeCents * sign) / 100).toFixed(2)}</td>
                        </tr>
                    ` : ""}
                    <tr>
                        <td style="padding: 8px 0; color: #0f172a; font-weight: 600; border-top: 1px solid #e2e8f0;">Total</td>
                        <td style="padding: 8px 0; color: #0f172a; text-align: right; font-weight: 600; border-top: 1px solid #e2e8f0;">$${((totalCents * sign) / 100).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        ` : "";

        let stayDetails = "";
        if (options.siteNumber || options.arrivalDate) {
            stayDetails = `
                <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <h3 style="margin: 0 0 12px 0; color: #334155; font-size: 14px;">Stay Details</h3>
                    ${options.siteNumber ? `<p style="margin: 4px 0; color: #64748b;">Site: <strong style="color: #0f172a;">${options.siteNumber}</strong></p>` : ""}
                    ${options.arrivalDate ? `<p style="margin: 4px 0; color: #64748b;">Check-in: <strong style="color: #0f172a;">${options.arrivalDate.toLocaleDateString()}</strong></p>` : ""}
                    ${options.departureDate ? `<p style="margin: 4px 0; color: #64748b;">Check-out: <strong style="color: #0f172a;">${options.departureDate.toLocaleDateString()}</strong></p>` : ""}
                </div>
            `;
        }

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: ${options.kind === "refund" ? "#f59e0b" : "#10b981"}; margin: 0;">${options.kind === "refund" ? "Refund Issued" : "Payment Received"}</h1>
                    <p style="color: #64748b; margin-top: 8px;">${options.kind === "refund" ? "We have processed your refund." : "Thank you for your payment!"}</p>
                </div>
                
                <div style="background: linear-gradient(135deg, ${options.kind === "refund" ? "#fbbf24 0%, #f59e0b 100%" : "#10b981 0%, #059669 100%"}); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="color: rgba(255,255,255,0.8); margin: 0 0 8px 0; font-size: 14px;">${options.kind === "refund" ? "Amount Refunded" : "Amount Paid"}</p>
                    <p style="color: white; margin: 0; font-size: 36px; font-weight: bold;">${formattedAmount}</p>
                </div>

                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px;">Receipt Details</h2>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Campground</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${options.campgroundName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Date</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9;">${transactionDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Payment Method</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9;">${options.paymentMethod || "Card"}</td>
                        </tr>
                        ${options.transactionId ? `
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Transaction ID</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-size: 12px;">${options.transactionId}</td>
                        </tr>
                        ` : ""}
                        ${options.reservationId ? `
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Reservation ID</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; font-family: monospace; font-size: 12px;">${options.reservationId}</td>
                        </tr>
                        ` : ""}
                    </table>
                </div>

                ${linesTable}

                ${stayDetails}

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        This is an automated receipt. Please keep this for your records.
                    </p>
                    <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
                        Questions? Contact ${options.campgroundName}
                    </p>
                </div>
            </div>
        `;

        // Validate email address
        if (!options.guestEmail || !options.guestEmail.includes('@')) {
            this.logger.warn(`Cannot send payment receipt: invalid or missing email address for guest ${options.guestName}`);
            return;
        }

        const subject = `Payment Receipt - ${formattedAmount} - ${options.campgroundName}`;

        const result = await this.sendEmail({
            to: options.guestEmail,
            subject,
            html
        });

        // Record the communication in the database if we have campground context
        if (options.campgroundId) {
            try {
                await this.prisma.communication.create({
                    data: {
                        campgroundId: options.campgroundId,
                        guestId: options.guestId,
                        reservationId: options.reservationId,
                        type: 'email',
                        direction: 'outbound',
                        subject,
                        body: html,
                        preview: `Payment receipt for ${formattedAmount}`,
                        status: result.fallback === 'log_only' ? 'pending' : 'sent',
                        provider: result.provider,
                        providerMessageId: result.providerMessageId,
                        toAddress: options.guestEmail,
                        sentAt: new Date(),
                        metadata: {
                            kind: options.kind ?? 'payment',
                            amountCents: options.amountCents,
                            paymentMethod: options.paymentMethod,
                            transactionId: options.transactionId
                        }
                    }
                });
            } catch (err) {
                this.logger.error('Failed to record payment receipt in communications:', err);
            }
        }
    }

    /**
     * Send ticket resolution notification to the submitter
     */
    async sendTicketResolved(options: {
        to: string;
        ticketId: string;
        ticketTitle: string;
        resolution: string;
        agentNotes?: string;
    }): Promise<void> {
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="background: #10b981; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                        <span style="color: white; font-size: 18px; font-weight: bold;">OK</span>
                    </div>
                    <h1 style="color: #0f172a; margin: 0;">Your Ticket Has Been Resolved</h1>
                    <p style="color: #64748b; margin-top: 8px;">Thank you for your feedback!</p>
                </div>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h2 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">${options.ticketTitle}</h2>
                    <p style="margin: 0; color: #64748b; font-size: 12px;">Ticket ID: ${options.ticketId}</p>
                </div>

                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                    <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px;">Resolution</h3>
                    <p style="margin: 0; color: #334155; line-height: 1.6;">${options.resolution || 'Your ticket has been resolved.'}</p>
                    
                    ${options.agentNotes ? `
                        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                            <h4 style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Agent Notes</h4>
                            <p style="margin: 0; color: #334155; line-height: 1.6;">${options.agentNotes}</p>
                        </div>
                    ` : ''}
                </div>

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        If you have any follow-up questions, please submit a new ticket.
                    </p>
                    <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
                        Camp Everyday Support
                    </p>
                </div>
            </div>
        `;

        await this.sendEmail({
            to: options.to,
            subject: `Ticket Resolved: ${options.ticketTitle}`,
            html
        });
    }

    /**
     * Send shift swap request notification
     */
    async sendShiftSwapRequest(options: {
        recipientEmail: string;
        recipientName: string;
        requesterName: string;
        campgroundName: string;
        shiftDate: Date;
        shiftStartTime: string;
        shiftEndTime: string;
        role?: string;
        note?: string;
        actionUrl?: string;
    }): Promise<void> {
        const shiftDateStr = options.shiftDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                        <span style="color: white; font-size: 18px; font-weight: bold;">SWAP</span>
                    </div>
                    <h1 style="color: #0f172a; margin: 0;">Shift Swap Request</h1>
                    <p style="color: #64748b; margin-top: 8px;">Someone wants to swap shifts with you</p>
                </div>

                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 16px 0; color: #334155;">
                        Hi ${options.recipientName},
                    </p>
                    <p style="margin: 0; color: #334155; line-height: 1.6;">
                        <strong>${options.requesterName}</strong> would like you to take their shift:
                    </p>
                </div>

                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px;">Shift Details</h2>

                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Date</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${shiftDateStr}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Time</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9;">${options.shiftStartTime} - ${options.shiftEndTime}</td>
                        </tr>
                        ${options.role ? `
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Role</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9;">${options.role}</td>
                        </tr>
                        ` : ""}
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Location</td>
                            <td style="padding: 8px 0; color: #0f172a; text-align: right;">${options.campgroundName}</td>
                        </tr>
                    </table>
                </div>

                ${options.note ? `
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px 0; color: #92400e; font-size: 12px; font-weight: 600;">NOTE FROM ${options.requesterName.toUpperCase()}</p>
                    <p style="margin: 0; color: #78350f;">${options.note}</p>
                </div>
                ` : ""}

                ${options.actionUrl ? `
                <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${options.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                        Review Request
                    </a>
                </div>
                ` : ""}

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        Log in to accept or decline this swap request.
                    </p>
                    <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
                        ${options.campgroundName} Staff Scheduling
                    </p>
                </div>
            </div>
        `;

        await this.sendEmail({
            to: options.recipientEmail,
            subject: `Shift Swap Request from ${options.requesterName} - ${options.campgroundName}`,
            html
        });
    }

    /**
     * Send shift swap decision notification (approved/rejected by manager)
     */
    async sendShiftSwapDecision(options: {
        recipientEmail: string;
        recipientName: string;
        approved: boolean;
        campgroundName: string;
        shiftDate: Date;
        shiftStartTime: string;
        shiftEndTime: string;
        managerName?: string;
        note?: string;
    }): Promise<void> {
        const shiftDateStr = options.shiftDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric"
        });

        const statusColor = options.approved ? "#10b981" : "#ef4444";
        const statusText = options.approved ? "Approved" : "Rejected";
        const statusIcon = options.approved ? "OK" : "X";

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="background: ${statusColor}; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                        <span style="color: white; font-size: 28px;">${statusIcon}</span>
                    </div>
                    <h1 style="color: #0f172a; margin: 0;">Shift Swap ${statusText}</h1>
                    <p style="color: #64748b; margin-top: 8px;">Your swap request has been ${statusText.toLowerCase()}</p>
                </div>

                <div style="background: ${options.approved ? "#ecfdf5" : "#fef2f2"}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #334155;">
                        Hi ${options.recipientName}, your shift swap request for <strong>${shiftDateStr}</strong> (${options.shiftStartTime} - ${options.shiftEndTime}) has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong>${options.managerName ? ` by ${options.managerName}` : ""}.
                    </p>
                </div>

                ${options.note ? `
                <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 600;">MANAGER NOTE</p>
                    <p style="margin: 0; color: #334155;">${options.note}</p>
                </div>
                ` : ""}

                ${options.approved ? `
                <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="margin: 0; color: #065f46; font-weight: 500;">
                        The shift has been reassigned. Check the schedule for your updated shifts.
                    </p>
                </div>
                ` : ""}

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                        ${options.campgroundName} Staff Scheduling
                    </p>
                </div>
            </div>
        `;

        await this.sendEmail({
            to: options.recipientEmail,
            subject: `Shift Swap ${statusText} - ${options.campgroundName}`,
            html
        });
    }

    /**
     * Send a scheduled report email
     */
    async sendScheduledReport(options: {
        to: string;
        reportName: string;
        campgroundName?: string;
        period: string;
        summary: string;
        metrics?: { label: string; value: string }[];
        reportUrl?: string;
    }): Promise<void> {
        const metricsHtml = options.metrics?.length ? `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                ${options.metrics.map((m, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
                        <td style="padding: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">${m.label}</td>
                        <td style="padding: 12px; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${m.value}</td>
                    </tr>
                `).join('')}
            </table>
        ` : '';

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #0f172a; margin: 0;">${options.reportName}</h1>
                    <p style="color: #64748b; margin-top: 8px;">
                        ${options.campgroundName ? `${options.campgroundName} • ` : ''}${options.period}
                    </p>
                </div>

                <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 16px; line-height: 1.6;">${options.summary}</p>
                </div>

                ${metricsHtml}

                ${options.reportUrl ? `
                    <div style="text-align: center; margin-top: 24px;">
                        <a href="${options.reportUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                            View Full Report
                        </a>
                    </div>
                ` : ''}

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                        This is an automated report. Manage your email preferences in Settings.
                    </p>
                </div>
            </div>
        `;

        await this.sendEmail({
            to: options.to,
            subject: `${options.reportName} - ${options.period}`,
            html
        });
    }
}

