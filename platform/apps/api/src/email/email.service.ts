import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

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

    constructor() {
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const secure = process.env.SMTP_SECURE === "true";
        this.postmarkToken = process.env.POSTMARK_SERVER_TOKEN || null;

        if (host && port && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure,
                auth: { user, pass }
            });
            this.logger.log(`EmailService using SMTP: ${host}:${port} secure=${secure}`);
        } else if (!this.postmarkToken) {
            this.logger.warn("SMTP and Postmark not configured; falling back to console logging emails.");
        }
    }

    async sendEmail(options: EmailOptions): Promise<{ providerMessageId?: string; provider?: string; fallback?: string }> {
        const fromEmail = process.env.SMTP_FROM || "no-reply@campreserv.com";

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
                throw new Error(`Postmark send failed: ${res.status} ${JSON.stringify(data)}`);
            }
            this.logger.log(`Email sent via Postmark to ${options.to} (${options.subject})`);
            return { providerMessageId: data.MessageID, provider: "postmark" };
        };

        // Prefer Postmark API if token is set, with one retry/backoff before failing over
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
SENDING EMAIL (LOG ONLY - configure SMTP or POSTMARK to send)
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
                            <td style="padding: 6px 0; color: #0f172a; text-align: right;">$${(li.amountCents / 100).toFixed(2)}</td>
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

        await this.sendEmail({
            to: options.guestEmail,
            subject: `Payment Receipt - ${formattedAmount} - ${options.campgroundName}`,
            html
        });
    }
}

