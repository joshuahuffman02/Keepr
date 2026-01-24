import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SeasonalPaymentStatus } from "@prisma/client";
import { randomUUID } from "crypto";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasToNumber = (value: unknown): value is { toNumber: () => number } =>
  isRecord(value) && typeof value.toNumber === "function";

const coerceNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (hasToNumber(value)) return value.toNumber();
  return 0;
};

@Injectable()
export class SeasonalsScheduler {
  private readonly logger = new Logger(SeasonalsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Daily job to mark overdue seasonal payments as past_due
   * Runs at 1:00 AM every day
   */
  @Cron("0 1 * * *")
  async markOverduePayments() {
    const now = new Date();

    try {
      // First, find the payments that will be marked past_due (for notifications)
      const overduePayments = await this.prisma.seasonalPayment.findMany({
        where: {
          status: { in: [SeasonalPaymentStatus.due, SeasonalPaymentStatus.scheduled] },
          dueDate: { lt: now },
        },
        include: {
          SeasonalGuest: {
            include: {
              Guest: { select: { id: true, email: true, primaryFirstName: true } },
              Campground: { select: { id: true, name: true } },
              Site: { select: { siteNumber: true } },
            },
          },
        },
      });

      if (overduePayments.length === 0) {
        return;
      }

      // Update the status
      const result = await this.prisma.seasonalPayment.updateMany({
        where: {
          id: { in: overduePayments.map((p) => p.id) },
        },
        data: {
          status: SeasonalPaymentStatus.past_due,
        },
      });

      this.logger.log(`Marked ${result.count} seasonal payments as past_due`);

      // Send past_due notification emails to guests
      for (const payment of overduePayments) {
        const guest = payment.SeasonalGuest?.Guest;
        const campground = payment.SeasonalGuest?.Campground;
        const site = payment.SeasonalGuest?.Site;

        if (!guest?.email || !campground) continue;

        const guestName = guest.primaryFirstName || "Seasonal Guest";
        const amountDollars = (Number(payment.amount) / 100).toFixed(2);
        const dueDateStr = payment.dueDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        try {
          await this.emailService.sendEmail({
            to: guest.email,
            subject: `OVERDUE: Payment of $${amountDollars} is Past Due`,
            html: this.buildPastDueEmailHtml({
              guestName,
              campgroundName: campground.name,
              siteNumber: site?.siteNumber,
              amountDollars,
              dueDateStr,
            }),
            guestId: guest.id,
            campgroundId: campground.id,
          });
        } catch (emailError) {
          this.logger.error(
            `Failed to send past_due notification for payment ${payment.id}: ${emailError instanceof Error ? emailError.message : emailError}`,
          );
        }
      }

      // Group by campground for staff notifications
      const byCampground = new Map<string, typeof overduePayments>();
      for (const payment of overduePayments) {
        const cgId = payment.SeasonalGuest?.Campground?.id;
        if (!cgId) continue;
        const list = byCampground.get(cgId) || [];
        list.push(payment);
        byCampground.set(cgId, list);
      }

      // Log summary for ops and potential staff notification
      for (const [campgroundId, payments] of byCampground) {
        const totalOverdue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const campgroundName = payments[0]?.SeasonalGuest?.Campground?.name || campgroundId;
        this.logger.warn(
          `${campgroundName}: ${payments.length} payments now past_due, total $${(totalOverdue / 100).toFixed(2)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark overdue payments: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Build HTML email body for past_due notification
   */
  private buildPastDueEmailHtml(options: {
    guestName: string;
    campgroundName: string;
    siteNumber?: string;
    amountDollars: string;
    dueDateStr: string;
  }): string {
    const { guestName, campgroundName, siteNumber, amountDollars, dueDateStr } = options;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 12px 16px; margin-bottom: 20px;">
          <strong style="color: #991B1B;">Payment Overdue</strong>
          <p style="margin: 4px 0 0 0; color: #991B1B;">Your seasonal payment is now past due. Please make payment as soon as possible.</p>
        </div>

        <h2 style="color: #111827; margin-bottom: 16px;">Hi ${guestName},</h2>

        <p>Your seasonal payment at <strong>${campgroundName}</strong>${siteNumber ? ` (Site ${siteNumber})` : ""} is now <strong>past due</strong>.</p>

        <div style="background-color: #FEF2F2; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Amount Overdue:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 18px; color: #DC2626;">$${amountDollars}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Original Due Date:</td>
              <td style="padding: 8px 0; text-align: right; color: #111827;">${dueDateStr}</td>
            </tr>
          </table>
        </div>

        <p><strong>Please make your payment as soon as possible</strong> to avoid any additional late fees or potential service interruptions to your seasonal site.</p>

        <p>If you are experiencing difficulties or need to set up a payment plan, please contact the campground office immediately.</p>

        <p style="margin-top: 24px; color: #6B7280; font-size: 14px;">
          Thank you for your prompt attention to this matter.<br>
          <strong>${campgroundName}</strong>
        </p>
      </body>
      </html>
    `;
  }

  /**
   * Weekly job to send payment reminder notifications (7 days out)
   * Runs at 9:00 AM every Monday
   */
  @Cron("0 9 * * 1")
  async sendWeeklyPaymentReminders() {
    await this.sendPaymentReminders(7, "weekly");
  }

  /**
   * Daily job to send urgent payment reminders (3 days out)
   * Runs at 9:00 AM every day
   */
  @Cron("0 9 * * *")
  async sendUrgentPaymentReminders() {
    await this.sendPaymentReminders(3, "urgent");
  }

  /**
   * Send payment reminder emails for payments due within specified days
   */
  private async sendPaymentReminders(daysAhead: number, reminderType: "weekly" | "urgent") {
    const now = new Date();
    const targetDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    try {
      // Find payments due within the specified window
      const upcomingPayments = await this.prisma.seasonalPayment.findMany({
        where: {
          status: { in: [SeasonalPaymentStatus.due, SeasonalPaymentStatus.scheduled] },
          dueDate: {
            gte: now,
            lte: targetDate,
          },
          // Don't send reminders for very small amounts
          amount: { gte: 100 }, // At least $1
        },
        include: {
          SeasonalGuest: {
            include: {
              Guest: {
                select: { id: true, email: true, primaryFirstName: true, primaryLastName: true },
              },
              Campground: { select: { id: true, name: true } },
              Site: { select: { siteNumber: true } },
            },
          },
        },
      });

      if (upcomingPayments.length === 0) {
        this.logger.debug(`No seasonal payments due within ${daysAhead} days`);
        return;
      }

      this.logger.log(
        `Sending ${reminderType} reminders for ${upcomingPayments.length} seasonal payments due within ${daysAhead} days`,
      );

      let sent = 0;
      let failed = 0;

      for (const payment of upcomingPayments) {
        const guest = payment.SeasonalGuest?.Guest;
        const campground = payment.SeasonalGuest?.Campground;
        const site = payment.SeasonalGuest?.Site;

        if (!guest?.email || !campground) {
          this.logger.warn(`Skipping payment ${payment.id}: missing guest email or campground`);
          continue;
        }

        const guestName = guest.primaryFirstName || "Seasonal Guest";
        const amountDollars = (Number(payment.amount) / 100).toFixed(2);
        const dueDateStr = payment.dueDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const isUrgent = reminderType === "urgent";
        const subject = isUrgent
          ? `Payment Reminder: $${amountDollars} Due ${dueDateStr}`
          : `Upcoming Payment: $${amountDollars} Due ${dueDateStr}`;

        const html = this.buildPaymentReminderHtml({
          guestName,
          campgroundName: campground.name,
          siteNumber: site?.siteNumber,
          amountDollars,
          dueDateStr,
          isUrgent,
        });

        try {
          await this.emailService.sendEmail({
            to: guest.email,
            subject,
            html,
            guestId: guest.id,
            campgroundId: campground.id,
          });
          sent++;
        } catch (emailError) {
          this.logger.error(
            `Failed to send reminder for payment ${payment.id}: ${emailError instanceof Error ? emailError.message : emailError}`,
          );
          failed++;
        }
      }

      this.logger.log(`Payment reminder emails sent: ${sent} successful, ${failed} failed`);
    } catch (error) {
      this.logger.error(
        `Failed to process payment reminders: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Build HTML email body for payment reminder
   */
  private buildPaymentReminderHtml(options: {
    guestName: string;
    campgroundName: string;
    siteNumber?: string;
    amountDollars: string;
    dueDateStr: string;
    isUrgent: boolean;
  }): string {
    const { guestName, campgroundName, siteNumber, amountDollars, dueDateStr, isUrgent } = options;

    const urgentBanner = isUrgent
      ? `<div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin-bottom: 20px;">
          <strong style="color: #92400E;">Payment Due Soon</strong>
          <p style="margin: 4px 0 0 0; color: #92400E;">Your seasonal payment is due within 3 days.</p>
        </div>`
      : "";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${urgentBanner}

        <h2 style="color: #111827; margin-bottom: 16px;">Hi ${guestName},</h2>

        <p>This is a friendly reminder about your upcoming seasonal payment at <strong>${campgroundName}</strong>${siteNumber ? ` (Site ${siteNumber})` : ""}.</p>

        <div style="background-color: #F9FAFB; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Amount Due:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 18px; color: #111827;">$${amountDollars}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Due Date:</td>
              <td style="padding: 8px 0; text-align: right; color: #111827;">${dueDateStr}</td>
            </tr>
          </table>
        </div>

        <p>Please ensure your payment is made by the due date to avoid any late fees or service interruptions.</p>

        <p>If you have any questions or need to make payment arrangements, please contact the campground office.</p>

        <p style="margin-top: 24px; color: #6B7280; font-size: 14px;">
          Thank you for being a valued seasonal guest!<br>
          <strong>${campgroundName}</strong>
        </p>
      </body>
      </html>
    `;
  }

  /**
   * Monthly job to generate payment schedules for the next month
   * Runs at 6:00 AM on the 25th of each month
   */
  @Cron("0 6 25 * *")
  async generateNextMonthPayments() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    try {
      // Find active seasonal guests with monthly billing who don't have a payment for next month
      const seasonalsNeedingPayment = await this.prisma.seasonalGuest.findMany({
        where: {
          status: "active",
          // Only process monthly billing guests
          SeasonalPayment: {
            none: {
              dueDate: {
                gte: nextMonth,
                lte: nextMonthEnd,
              },
            },
          },
        },
        include: {
          SeasonalGuestPricing: {
            where: { seasonYear: nextMonth.getFullYear() },
            take: 1,
          },
        },
      });

      let created = 0;

      for (const seasonal of seasonalsNeedingPayment) {
        const pricing = seasonal.SeasonalGuestPricing[0];
        if (!pricing) continue;

        // Calculate monthly amount from annual rate
        // Assuming 6-month season for now (can be enhanced with rate card dates)
        const annualRate = coerceNumber(pricing.finalRate);
        const monthlyAmount = annualRate > 0 ? annualRate / 6 : 0;

        if (monthlyAmount > 0) {
          await this.prisma.seasonalPayment.create({
            data: {
              id: randomUUID(),
              seasonalGuestId: seasonal.id,
              campgroundId: seasonal.campgroundId,
              seasonYear: nextMonth.getFullYear(),
              periodStart: nextMonth,
              periodEnd: nextMonthEnd,
              amount: monthlyAmount,
              dueDate: new Date(
                nextMonth.getFullYear(),
                nextMonth.getMonth(),
                seasonal.paymentDay || 1,
              ),
              status: SeasonalPaymentStatus.scheduled,
              updatedAt: new Date(),
            },
          });
          created++;
        }
      }

      if (created > 0) {
        this.logger.log(
          `Generated ${created} seasonal payment records for ${nextMonth.toLocaleString("default", { month: "long", year: "numeric" })}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate next month payments: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
