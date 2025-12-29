import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
    constructor(private readonly emailService: EmailService) {}

    @Get('test')
    async sendTestEmail(@Query('to') to: string) {
        if (!to) {
            return { error: 'Missing "to" query parameter' };
        }

        const result = await this.emailService.sendEmail({
            to,
            subject: 'Camp Everyday - Test Email',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #10b981; margin: 0;">Email is Working!</h1>
                        <p style="color: #64748b; margin-top: 8px;">Your Resend integration is set up correctly.</p>
                    </div>

                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <p style="color: white; margin: 0; font-size: 18px;">Camp Everyday is ready to send emails!</p>
                    </div>

                    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #334155; font-size: 14px;">
                            <strong>Provider:</strong> Resend<br>
                            <strong>Time:</strong> ${new Date().toLocaleString()}<br>
                            <strong>To:</strong> ${to}
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                            This is a test email from Camp Everyday
                        </p>
                    </div>
                </div>
            `
        });

        return {
            success: true,
            message: `Test email sent to ${to}`,
            provider: result.provider,
            providerMessageId: result.providerMessageId
        };
    }
}
