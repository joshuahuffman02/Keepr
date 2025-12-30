import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { Prisma } from '@prisma/client';

export type TriggerEvent = 
  | 'reservation_created'
  | 'reservation_confirmed'
  | 'reservation_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'site_ready'
  | 'balance_due'
  | 'review_request'
  | 'waitlist_match'
  | 'group_update';

export interface NotificationTrigger {
  id: string;
  campgroundId: string;
  event: TriggerEvent;
  channel: 'email' | 'sms' | 'both';
  enabled: boolean;
  templateId?: string;
  delayMinutes: number;
  conditions?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerPayload {
  campgroundId: string;
  reservationId?: string;
  guestId?: string;
  guestEmail?: string;
  guestName?: string;
  siteNumber?: string;
  arrivalDate?: Date;
  departureDate?: Date;
  amountCents?: number;
  customData?: Record<string, any>;
}

@Injectable()
export class NotificationTriggersService {
  private readonly logger = new Logger(NotificationTriggersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Get all triggers for a campground
   */
  async list(campgroundId: string) {
    return this.prisma.notificationTrigger.findMany({
      where: { campgroundId },
      orderBy: [{ event: 'asc' }, { createdAt: 'desc' }],
      include: { template: true }
    });
  }

  /**
   * Create a new trigger
   */
  async create(campgroundId: string, data: {
    event: TriggerEvent;
    channel: 'email' | 'sms' | 'both';
    enabled?: boolean;
    templateId?: string;
    delayMinutes?: number;
    conditions?: Record<string, any>;
  }) {
    return this.prisma.notificationTrigger.create({
      data: {
        campgroundId,
        event: data.event,
        channel: data.channel,
        enabled: data.enabled ?? true,
        templateId: data.templateId ?? null,
        delayMinutes: data.delayMinutes ?? 0,
        conditions: (data.conditions ?? null) as Prisma.InputJsonValue
      }
    });
  }

  /**
   * Validate trigger belongs to campground (multi-tenant isolation)
   */
  private async validateTriggerOwnership(id: string, campgroundId: string): Promise<void> {
    const trigger = await this.prisma.notificationTrigger.findUnique({
      where: { id },
      select: { campgroundId: true }
    });

    if (!trigger) {
      throw new NotFoundException(`Trigger ${id} not found`);
    }

    if (trigger.campgroundId !== campgroundId) {
      throw new ForbiddenException('Access denied to this trigger');
    }
  }

  /**
   * Update a trigger
   * @param id - Trigger ID
   * @param data - Update data
   * @param campgroundId - Optional campgroundId for ownership validation (required for cross-tenant protection)
   */
  async update(id: string, data: Partial<{
    event: TriggerEvent;
    channel: 'email' | 'sms' | 'both';
    enabled: boolean;
    templateId: string | null;
    delayMinutes: number;
    conditions: Record<string, any> | null;
  }>, campgroundId?: string) {
    // Validate ownership if campgroundId provided
    if (campgroundId) {
      await this.validateTriggerOwnership(id, campgroundId);
    }

    return this.prisma.notificationTrigger.update({
      where: { id },
      data: {
        ...data,
        conditions: data.conditions as Prisma.InputJsonValue | undefined
      }
    });
  }

  /**
   * Delete a trigger
   * @param id - Trigger ID
   * @param campgroundId - Optional campgroundId for ownership validation (required for cross-tenant protection)
   */
  async delete(id: string, campgroundId?: string) {
    // Validate ownership if campgroundId provided
    if (campgroundId) {
      await this.validateTriggerOwnership(id, campgroundId);
    }

    return this.prisma.notificationTrigger.delete({
      where: { id }
    });
  }

  /**
   * Fire a trigger event
   */
  async fire(event: TriggerEvent, payload: TriggerPayload) {
    this.logger.log(`Firing trigger event: ${event} for campground ${payload.campgroundId}`);

    // Find enabled triggers for this event
    const triggers = await this.prisma.notificationTrigger.findMany({
      where: {
        campgroundId: payload.campgroundId,
        event,
        enabled: true
      },
      include: { template: true }
    });

    if (triggers.length === 0) {
      this.logger.debug(`No triggers configured for event ${event}`);
      return { fired: 0 };
    }

    let fired = 0;
    for (const trigger of triggers) {
      // Check conditions
      if (trigger.conditions && !this.matchesConditions(trigger.conditions as Record<string, any>, payload)) {
        continue;
      }

      // Schedule or send immediately
      if (trigger.delayMinutes > 0) {
        await this.scheduleNotification(trigger, payload);
      } else {
        await this.sendNotification(trigger, payload);
      }
      fired++;
    }

    return { fired };
  }

  /**
   * Check if payload matches trigger conditions
   */
  private matchesConditions(conditions: Record<string, any>, payload: TriggerPayload): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      const payloadValue = (payload as any)[key] ?? payload.customData?.[key];
      
      if (typeof value === 'object' && value !== null) {
        // Handle operators like { gt: 100, lt: 1000 }
        if (value.gt !== undefined && !(payloadValue > value.gt)) return false;
        if (value.lt !== undefined && !(payloadValue < value.lt)) return false;
        if (value.eq !== undefined && payloadValue !== value.eq) return false;
        if (value.in !== undefined && !value.in.includes(payloadValue)) return false;
      } else if (payloadValue !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Schedule a notification for later
   */
  private async scheduleNotification(trigger: any, payload: TriggerPayload) {
    const sendAt = new Date(Date.now() + trigger.delayMinutes * 60 * 1000);
    
    await this.prisma.scheduledNotification.create({
      data: {
        campgroundId: payload.campgroundId,
        triggerId: trigger.id,
        event: trigger.event,
        channel: trigger.channel,
        payload: payload as any,
        sendAt,
        status: 'pending'
      }
    });

    this.logger.log(`Scheduled notification for ${sendAt.toISOString()}`);
  }

  /**
   * Send a notification immediately
   */
  private async sendNotification(trigger: any, payload: TriggerPayload) {
    const template = trigger.template;
    
    if (!payload.guestEmail) {
      this.logger.warn(`Cannot send notification: no guest email provided`);
      return;
    }

    // Get campground info
    const campground = await this.prisma.campground.findUnique({
      where: { id: payload.campgroundId },
      select: { name: true }
    });

    // Build email content
    const subject = template?.subject 
      ? this.interpolate(template.subject, payload, campground)
      : this.getDefaultSubject(trigger.event, campground?.name);

    const html = template?.html 
      ? this.interpolate(template.html, payload, campground)
      : this.getDefaultHtml(trigger.event, payload, campground?.name);

    if (trigger.channel === 'email' || trigger.channel === 'both') {
      await this.emailService.sendEmail({
        to: payload.guestEmail,
        subject,
        html,
        campgroundId: payload.campgroundId,
        reservationId: payload.reservationId,
        guestId: payload.guestId
      });
    }

    // SMS handling with feature flag
    if ((trigger.channel === 'sms' || trigger.channel === 'both') && payload.customData?.phone) {
      const smsBody = this.stripHtml(html).substring(0, 160); // SMS length limit
      const result = await this.smsService.sendSms({
        to: payload.customData.phone,
        body: smsBody,
        campgroundId: payload.campgroundId,
        reservationId: payload.reservationId
      });
      if (!result.success) {
        this.logger.warn(`SMS send returned: ${result.fallback || result.provider}`);
      }
    }

    this.logger.log(`Sent ${trigger.channel} notification for ${trigger.event}`);
  }

  /**
   * Strip HTML tags for SMS
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Interpolate template variables
   */
  private interpolate(template: string, payload: TriggerPayload, campground?: { name: string } | null): string {
    const vars: Record<string, string> = {
      '{{guest_name}}': payload.guestName || 'Guest',
      '{{campground_name}}': campground?.name || 'our campground',
      '{{site_number}}': payload.siteNumber || '',
      '{{arrival_date}}': payload.arrivalDate?.toLocaleDateString() || '',
      '{{departure_date}}': payload.departureDate?.toLocaleDateString() || '',
      '{{amount}}': payload.amountCents ? `$${(payload.amountCents / 100).toFixed(2)}` : '',
      '{{reservation_id}}': payload.reservationId || '',
    };

    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(key, 'g'), value);
    }
    return result;
  }

  /**
   * Get default subject for event
   */
  private getDefaultSubject(event: TriggerEvent, campgroundName?: string): string {
    const name = campgroundName || 'our campground';
    const subjects: Record<TriggerEvent, string> = {
      reservation_created: `Reservation Confirmed at ${name}`,
      reservation_confirmed: `Your Reservation is Confirmed - ${name}`,
      reservation_cancelled: `Reservation Cancelled - ${name}`,
      payment_received: `Payment Received - ${name}`,
      payment_failed: `Payment Issue - Action Required - ${name}`,
      checkin_reminder: `Check-in Reminder - ${name}`,
      checkout_reminder: `Check-out Reminder - ${name}`,
      site_ready: `Your Site is Ready! - ${name}`,
      balance_due: `Balance Due Reminder - ${name}`,
      review_request: `How was your stay at ${name}?`,
      waitlist_match: `Good News! A site is available at ${name}`,
      group_update: `Group Booking Update - ${name}`,
    };
    return subjects[event] || `Update from ${name}`;
  }

  /**
   * Get default HTML for event
   */
  private getDefaultHtml(event: TriggerEvent, payload: TriggerPayload, campgroundName?: string): string {
    const name = campgroundName || 'our campground';
    const guestName = payload.guestName || 'Guest';

    const templates: Record<TriggerEvent, string> = {
      reservation_created: `
        <h1>Reservation Confirmed!</h1>
        <p>Dear ${guestName},</p>
        <p>Your reservation at <strong>${name}</strong> has been confirmed.</p>
        ${payload.siteNumber ? `<p><strong>Site:</strong> ${payload.siteNumber}</p>` : ''}
        ${payload.arrivalDate ? `<p><strong>Check-in:</strong> ${payload.arrivalDate.toLocaleDateString()}</p>` : ''}
        ${payload.departureDate ? `<p><strong>Check-out:</strong> ${payload.departureDate.toLocaleDateString()}</p>` : ''}
        <p>We look forward to seeing you!</p>
      `,
      reservation_confirmed: `
        <h1>Your Reservation is Confirmed</h1>
        <p>Dear ${guestName},</p>
        <p>Your reservation at ${name} is confirmed and ready.</p>
      `,
      reservation_cancelled: `
        <h1>Reservation Cancelled</h1>
        <p>Dear ${guestName},</p>
        <p>Your reservation at ${name} has been cancelled.</p>
        <p>If this was a mistake, please contact us immediately.</p>
      `,
      payment_received: `
        <h1>Payment Received</h1>
        <p>Dear ${guestName},</p>
        <p>We've received your payment of ${payload.amountCents ? `$${(payload.amountCents / 100).toFixed(2)}` : 'your payment'}.</p>
        <p>Thank you!</p>
      `,
      payment_failed: `
        <h1>Payment Issue</h1>
        <p>Dear ${guestName},</p>
        <p>We were unable to process your payment. Please update your payment method.</p>
      `,
      checkin_reminder: `
        <h1>Check-in Reminder</h1>
        <p>Dear ${guestName},</p>
        <p>Your stay at ${name} begins tomorrow!</p>
        ${payload.siteNumber ? `<p>You'll be at <strong>Site ${payload.siteNumber}</strong>.</p>` : ''}
      `,
      checkout_reminder: `
        <h1>Check-out Reminder</h1>
        <p>Dear ${guestName},</p>
        <p>Your checkout is tomorrow. Please vacate by 11:00 AM.</p>
      `,
      site_ready: `
        <h1>Your Site is Ready!</h1>
        <p>Dear ${guestName},</p>
        <p>Great news! Site ${payload.siteNumber} is cleaned and ready for your arrival.</p>
      `,
      balance_due: `
        <h1>Balance Due Reminder</h1>
        <p>Dear ${guestName},</p>
        <p>You have an outstanding balance of ${payload.amountCents ? `$${(payload.amountCents / 100).toFixed(2)}` : 'some amount'} for your reservation.</p>
      `,
      review_request: `
        <h1>How was your stay?</h1>
        <p>Dear ${guestName},</p>
        <p>Thank you for staying at ${name}! We'd love to hear about your experience.</p>
      `,
      waitlist_match: `
        <h1>Site Available!</h1>
        <p>Dear ${guestName},</p>
        <p>A site matching your preferences is now available. Book now before it's gone!</p>
      `,
      group_update: `
        <h1>Group Booking Update</h1>
        <p>Dear ${guestName},</p>
        <p>There's been an update to your group booking at ${name}.</p>
      `,
    };

    return templates[event] || `<p>Update from ${name}</p>`;
  }

  /**
   * Send a test notification to verify the trigger is configured correctly
   * @param triggerId - Trigger ID
   * @param testEmail - Email to send test to
   * @param campgroundId - Optional campgroundId for ownership validation (required for cross-tenant protection)
   */
  async sendTestNotification(triggerId: string, testEmail: string, campgroundId?: string) {
    this.logger.log(`Sending test notification for trigger ${triggerId} to ${testEmail}`);

    // Validate ownership if campgroundId provided
    if (campgroundId) {
      await this.validateTriggerOwnership(triggerId, campgroundId);
    }

    // Get the trigger with its template
    const trigger = await this.prisma.notificationTrigger.findUnique({
      where: { id: triggerId },
      include: { template: true, campground: { select: { name: true } } }
    });

    if (!trigger) {
      throw new NotFoundException('Trigger not found');
    }

    // Create sample payload with test data
    const samplePayload: TriggerPayload = {
      campgroundId: trigger.campgroundId,
      reservationId: 'TEST-RES-12345',
      guestEmail: testEmail,
      guestName: 'Test Guest',
      siteNumber: 'A-15',
      arrivalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      departureDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      amountCents: 15000, // $150.00
    };

    const template = trigger.template;
    const campgroundName = (trigger as any).campground?.name || 'Sample Campground';

    // Build email content using template or defaults
    const subject = template?.subject
      ? this.interpolate(template.subject, samplePayload, { name: campgroundName })
      : `[TEST] ${this.getDefaultSubject(trigger.event as TriggerEvent, campgroundName)}`;

    const html = template?.html
      ? this.interpolate(template.html, samplePayload, { name: campgroundName })
      : this.getDefaultHtml(trigger.event as TriggerEvent, samplePayload, campgroundName);

    // Add test notice banner
    const testBanner = `
      <div style="background: #FEF3C7; border: 1px solid #F59E0B; padding: 12px; margin-bottom: 16px; border-radius: 8px;">
        <strong>TEST: This is a test notification</strong><br/>
        <span style="font-size: 14px; color: #92400E;">This is a preview of what your guests will receive when the "${trigger.event}" event is triggered.</span>
      </div>
    `;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${testBanner}
          ${html}
        </body>
      </html>
    `;

    // Send via email service
    if (trigger.channel === 'email' || trigger.channel === 'both') {
      await this.emailService.sendEmail({
        to: testEmail,
        subject: subject.startsWith('[TEST]') ? subject : `[TEST] ${subject}`,
        html: fullHtml,
        campgroundId: trigger.campgroundId,
      });
    }

    this.logger.log(`Test notification sent successfully to ${testEmail}`);
    return { success: true, message: `Test ${trigger.channel} notification sent to ${testEmail}` };
  }

  /**
   * Process scheduled notifications (runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledNotifications() {
    this.logger.debug('Processing scheduled notifications...');
    const now = new Date();
    
    const pending = await this.prisma.scheduledNotification.findMany({
      where: {
        status: 'pending',
        sendAt: { lte: now }
      },
      include: { trigger: { include: { template: true } } },
      take: 50
    });

    for (const notification of pending) {
      try {
        await this.sendNotification(notification.trigger, notification.payload as unknown as TriggerPayload);
        await this.prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { status: 'sent', sentAt: new Date() }
        });
      } catch (err) {
        this.logger.error(`Failed to send scheduled notification ${notification.id}: ${err}`);
        await this.prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { status: 'failed' }
        });
      }
    }

    return { processed: pending.length };
  }
}

