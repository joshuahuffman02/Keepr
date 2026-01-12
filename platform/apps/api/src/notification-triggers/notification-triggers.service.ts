import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from "crypto";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) return true;
  if (value instanceof Date) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
};

const toNullableJsonInput = (
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  if (value instanceof Date) return value.toISOString();
  return isJsonValue(value) ? value : undefined;
};

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

const TRIGGER_EVENTS: ReadonlyArray<TriggerEvent> = [
  'reservation_created',
  'reservation_confirmed',
  'reservation_cancelled',
  'payment_received',
  'payment_failed',
  'checkin_reminder',
  'checkout_reminder',
  'site_ready',
  'balance_due',
  'review_request',
  'waitlist_match',
  'group_update',
];

const isTriggerEvent = (value: string): value is TriggerEvent =>
  TRIGGER_EVENTS.some((event) => event === value);

export interface NotificationTrigger {
  id: string;
  campgroundId: string;
  event: TriggerEvent;
  channel: 'email' | 'sms' | 'both';
  enabled: boolean;
  templateId?: string;
  delayMinutes: number;
  conditions?: Record<string, unknown>;
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
  customData?: Record<string, unknown>;
}

const toDateValue = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
};

const parseTriggerPayload = (value: Prisma.JsonValue | null): TriggerPayload | null => {
  if (!isRecord(value)) return null;
  if (typeof value.campgroundId !== 'string') return null;

  return {
    campgroundId: value.campgroundId,
    reservationId: typeof value.reservationId === 'string' ? value.reservationId : undefined,
    guestId: typeof value.guestId === 'string' ? value.guestId : undefined,
    guestEmail: typeof value.guestEmail === 'string' ? value.guestEmail : undefined,
    guestName: typeof value.guestName === 'string' ? value.guestName : undefined,
    siteNumber: typeof value.siteNumber === 'string' ? value.siteNumber : undefined,
    arrivalDate: toDateValue(value.arrivalDate),
    departureDate: toDateValue(value.departureDate),
    amountCents: typeof value.amountCents === 'number' ? value.amountCents : undefined,
    customData: isRecord(value.customData) ? value.customData : undefined,
  };
};

type TriggerWithTemplate = Prisma.NotificationTriggerGetPayload<{
  include: { CampaignTemplate: true };
}>;

type TriggerWithTemplateAndCampground = Prisma.NotificationTriggerGetPayload<{
  include: { CampaignTemplate: true; Campground: { select: { name: true } } };
}>;

type NotificationTriggersStore = {
  notificationTrigger: {
    findMany: (args: Prisma.NotificationTriggerFindManyArgs) => Promise<TriggerWithTemplate[]>;
    findUnique: (args: Prisma.NotificationTriggerFindUniqueArgs) => Promise<TriggerWithTemplateAndCampground | null>;
    create: (args: Prisma.NotificationTriggerCreateArgs) => Promise<unknown>;
    update: (args: Prisma.NotificationTriggerUpdateArgs) => Promise<unknown>;
    delete: (args: Prisma.NotificationTriggerDeleteArgs) => Promise<unknown>;
  };
  scheduledNotification: {
    create: (args: Prisma.ScheduledNotificationCreateArgs) => Promise<unknown>;
    findMany: (args: Prisma.ScheduledNotificationFindManyArgs) => Promise<Array<{
      id: string;
      payload: Prisma.JsonValue | null;
      NotificationTrigger: TriggerWithTemplate;
    }>>;
    update: (args: Prisma.ScheduledNotificationUpdateArgs) => Promise<unknown>;
  };
  campground: {
    findUnique: (args: Prisma.CampgroundFindUniqueArgs) => Promise<{ name: string } | null>;
  };
};

type EmailSender = Pick<EmailService, 'sendEmail'>;
type SmsSender = Pick<SmsService, 'sendSms'>;

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
      include: { CampaignTemplate: true }
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
    conditions?: Record<string, unknown>;
  }) {
    const conditions = toNullableJsonInput(data.conditions);
    return this.prisma.notificationTrigger.create({
      data: {
        id: randomUUID(),
        campgroundId,
        event: data.event,
        channel: data.channel,
        enabled: data.enabled ?? true,
        templateId: data.templateId ?? null,
        delayMinutes: data.delayMinutes ?? 0,
        ...(conditions === undefined ? {} : { conditions }),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Validate trigger belongs to campground (multi-tenant isolation)
   */
  private async validateTriggerOwnership(id: string, campgroundId: string): Promise<void> {
    const trigger = await this.prisma.notificationTrigger.findUnique({
      where: { id },
      include: { CampaignTemplate: true, Campground: { select: { name: true } } }
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
   * @param campgroundId - Required campgroundId for ownership validation (multi-tenant isolation)
   */
  async update(id: string, data: Partial<{
    event: TriggerEvent;
    channel: 'email' | 'sms' | 'both';
    enabled: boolean;
    templateId: string | null;
    delayMinutes: number;
    conditions: Record<string, unknown> | null;
  }>, campgroundId: string) {
    // Always validate ownership for multi-tenant isolation
    await this.validateTriggerOwnership(id, campgroundId);

    const { conditions, ...rest } = data;
    const normalizedConditions = conditions === undefined ? undefined : toNullableJsonInput(conditions);

    return this.prisma.notificationTrigger.update({
      where: { id },
      data: {
        ...rest,
        ...(normalizedConditions === undefined ? {} : { conditions: normalizedConditions })
      }
    });
  }

  /**
   * Delete a trigger
   * @param id - Trigger ID
   * @param campgroundId - Required campgroundId for ownership validation (multi-tenant isolation)
   */
  async delete(id: string, campgroundId: string) {
    // Always validate ownership for multi-tenant isolation
    await this.validateTriggerOwnership(id, campgroundId);

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
      include: { CampaignTemplate: true }
    });

    if (triggers.length === 0) {
      this.logger.debug(`No triggers configured for event ${event}`);
      return { fired: 0 };
    }

    let fired = 0;
    for (const trigger of triggers) {
      // Check conditions
      const conditions = isRecord(trigger.conditions) ? trigger.conditions : null;
      if (conditions && !this.matchesConditions(conditions, payload)) {
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
  public matchesConditions(conditions: Record<string, unknown>, payload: TriggerPayload): boolean {
    const payloadRecord: Record<string, unknown> = {
      campgroundId: payload.campgroundId,
      reservationId: payload.reservationId,
      guestId: payload.guestId,
      guestEmail: payload.guestEmail,
      guestName: payload.guestName,
      siteNumber: payload.siteNumber,
      arrivalDate: payload.arrivalDate,
      departureDate: payload.departureDate,
      amountCents: payload.amountCents,
      customData: payload.customData,
    };

    for (const [key, value] of Object.entries(conditions)) {
      const payloadValue = payloadRecord[key] ?? payload.customData?.[key];
      
      if (isRecord(value)) {
        // Handle operators like { gt: 100, lt: 1000 }
        const gt = value.gt;
        if (gt !== undefined) {
          if (typeof gt !== "number" || typeof payloadValue !== "number" || payloadValue <= gt) return false;
        }
        const lt = value.lt;
        if (lt !== undefined) {
          if (typeof lt !== "number" || typeof payloadValue !== "number" || payloadValue >= lt) return false;
        }
        if (value.eq !== undefined && payloadValue !== value.eq) return false;
        if (Array.isArray(value.in) && !value.in.includes(payloadValue)) return false;
      } else if (payloadValue !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Schedule a notification for later
   */
  private async scheduleNotification(trigger: TriggerWithTemplate, payload: TriggerPayload) {
    const sendAt = new Date(Date.now() + trigger.delayMinutes * 60 * 1000);
    const payloadJson = toNullableJsonInput(payload);
    const payloadValue =
      payloadJson === undefined || payloadJson === Prisma.JsonNull
        ? Prisma.JsonNull
        : payloadJson;
    
    await this.prisma.scheduledNotification.create({
      data: {
        id: randomUUID(),
        campgroundId: payload.campgroundId,
        triggerId: trigger.id,
        event: trigger.event,
        channel: trigger.channel,
        payload: payloadValue,
        sendAt,
        status: 'pending',
        updatedAt: new Date()
      }
    });

    this.logger.log(`Scheduled notification for ${sendAt.toISOString()}`);
  }

  /**
   * Send a notification immediately
   */
  private async sendNotification(trigger: TriggerWithTemplate, payload: TriggerPayload) {
    const template = trigger.CampaignTemplate;
    
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
    const safeEvent = isTriggerEvent(trigger.event) ? trigger.event : 'reservation_created';
    const subject = template?.subject 
      ? this.interpolate(template.subject, payload, campground)
      : this.getDefaultSubject(safeEvent, campground?.name);

    const html = template?.html 
      ? this.interpolate(template.html, payload, campground)
      : this.getDefaultHtml(safeEvent, payload, campground?.name);

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
    const phone = payload.customData?.phone;
    if ((trigger.channel === 'sms' || trigger.channel === 'both') && typeof phone === 'string') {
      const smsBody = this.stripHtml(html).substring(0, 160); // SMS length limit
      const result = await this.smsService.sendSms({
        to: phone,
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
  public stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Interpolate template variables
   */
  public interpolate(template: string, payload: TriggerPayload, campground?: { name: string } | null): string {
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
  public getDefaultSubject(event: string, campgroundName?: string): string {
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
    if (isTriggerEvent(event)) {
      return subjects[event];
    }
    return `Update from ${name}`;
  }

  /**
   * Get default HTML for event
   */
  public getDefaultHtml(event: string, payload: TriggerPayload, campgroundName?: string): string {
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

    if (isTriggerEvent(event)) {
      return templates[event];
    }
    return `<p>Update from ${name}</p>`;
  }

  /**
   * Send a test notification to verify the trigger is configured correctly
   * @param triggerId - Trigger ID
   * @param testEmail - Email to send test to
   * @param campgroundId - Required campgroundId for ownership validation (multi-tenant isolation)
   */
  async sendTestNotification(triggerId: string, testEmail: string, campgroundId: string) {
    this.logger.log(`Sending test notification for trigger ${triggerId} to ${testEmail}`);

    // Always validate ownership for multi-tenant isolation
    await this.validateTriggerOwnership(triggerId, campgroundId);

    // Get the trigger with its template
    const trigger = await this.prisma.notificationTrigger.findUnique({
      where: { id: triggerId },
      include: { CampaignTemplate: true, Campground: { select: { name: true } } }
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

    const template = trigger.CampaignTemplate;
    const campgroundName = trigger.Campground?.name || 'Sample Campground';
    const safeEvent = isTriggerEvent(trigger.event) ? trigger.event : 'reservation_created';

    // Build email content using template or defaults
    const subject = template?.subject
      ? this.interpolate(template.subject, samplePayload, { name: campgroundName })
      : `[TEST] ${this.getDefaultSubject(safeEvent, campgroundName)}`;

    const html = template?.html
      ? this.interpolate(template.html, samplePayload, { name: campgroundName })
      : this.getDefaultHtml(safeEvent, samplePayload, campgroundName);

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
      include: { NotificationTrigger: { include: { CampaignTemplate: true } } },
      take: 50
    });

    for (const notification of pending) {
      try {
        const payload = parseTriggerPayload(notification.payload);
        if (!payload) {
          this.logger.warn(`Skipping scheduled notification ${notification.id}: invalid payload`);
          await this.prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { status: 'failed' }
          });
          continue;
        }

        await this.sendNotification(notification.NotificationTrigger, payload);
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
