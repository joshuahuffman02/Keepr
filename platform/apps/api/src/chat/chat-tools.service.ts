import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatParticipantType, MaintenancePriority, ReservationStatus, SiteType, OpTaskPriority, OpTaskState } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Request } from "express";
import { AuditService } from '../audit/audit.service';
import { HoldsService } from '../holds/holds.service';
import { AiPrivacyService } from '../ai/ai-privacy.service';

// Date string validation (YYYY-MM-DD format)
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD');
const opTaskStateSchema = z.enum(['pending', 'assigned', 'in_progress', 'blocked', 'completed', 'verified', 'cancelled']);
const opTaskStateFilterSchema = z.enum([
  'pending',
  'assigned',
  'in_progress',
  'blocked',
  'completed',
  'verified',
  'cancelled',
  'open',
]);
const opTaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

// Helper to get today's start/end in a specific timezone
function getTodayInTimezone(tz: string): { todayStart: Date; todayEnd: Date } {
  const nowInTz = new Date().toLocaleString("en-US", { timeZone: tz });
  const localNow = new Date(nowInTz);
  const todayStart = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate());
  const todayStartUtc = new Date(todayStart.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzOffset = todayStart.getTime() - todayStartUtc.getTime();
  const todayStartForQuery = new Date(todayStart.getTime() - tzOffset);
  const todayEndForQuery = new Date(todayStartForQuery.getTime() + 24 * 60 * 60 * 1000);
  return { todayStart: todayStartForQuery, todayEnd: todayEndForQuery };
}

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DATE_LOOKAHEAD_DAYS = 120;

const getTodayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const parseDateInput = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

const needsDateConfirmation = (start?: Date, end?: Date): boolean => {
  if (!start) return false;
  const todayStart = getTodayStart();
  const startIsFuture = start.getTime() >= todayStart.getTime();
  if (!startIsFuture) return false;
  const daysAhead = Math.floor((start.getTime() - todayStart.getTime()) / MS_PER_DAY);
  const currentYear = todayStart.getFullYear();
  const startYear = start.getFullYear();
  const endYear = end ? end.getFullYear() : startYear;
  const crossesYear = startYear !== endYear;
  const outsideCurrentYear = startYear !== currentYear || endYear !== currentYear;
  return daysAhead > MAX_DATE_LOOKAHEAD_DAYS || crossesYear || outsideCurrentYear;
};

const getDateConfirmationError = (
  startDate?: string,
  endDate?: string,
  confirmed?: boolean,
): string | null => {
  const parsedStart = parseDateInput(startDate);
  if (!parsedStart) return null;
  const parsedEnd = parseDateInput(endDate);
  if (!needsDateConfirmation(parsedStart, parsedEnd) || confirmed) return null;
  const rangeLabel = startDate && endDate
    ? `${startDate} to ${endDate}`
    : startDate ?? endDate ?? "the requested dates";
  return `That date range looks far out (${rangeLabel}). Did you mean this upcoming weekend? If not, please confirm the exact dates (YYYY-MM-DD to YYYY-MM-DD).`;
};

const formatCurrency = (amountCents?: number) => {
  if (amountCents === undefined || !Number.isFinite(amountCents)) return undefined;
  return `$${(amountCents / 100).toFixed(2)}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSiteType = (value: unknown): value is SiteType =>
  typeof value === "string" && value in SiteType;

const parseSiteType = (value: unknown): SiteType | undefined =>
  isSiteType(value) ? value : undefined;

const parseReservationStatus = (value: unknown): ReservationStatus | undefined => {
  switch (value) {
    case ReservationStatus.pending:
    case ReservationStatus.confirmed:
    case ReservationStatus.checked_in:
    case ReservationStatus.checked_out:
    case ReservationStatus.cancelled:
      return value;
    default:
      return undefined;
  }
};

const isOpTaskState = (value: unknown): value is OpTaskState =>
  typeof value === "string" && value in OpTaskState;

const parseOpTaskState = (value: unknown): OpTaskState | undefined =>
  isOpTaskState(value) ? value : undefined;

const parseOpTaskStateFilter = (value: unknown): OpTaskState | "open" | undefined => {
  if (value === "open") return "open";
  return parseOpTaskState(value);
};

const isOpTaskPriority = (value: unknown): value is OpTaskPriority =>
  typeof value === "string" && value in OpTaskPriority;

const parseOpTaskPriority = (value: unknown): OpTaskPriority | undefined =>
  isOpTaskPriority(value) ? value : undefined;

const parseOpTaskStateFilters = (
  value: unknown
): { states: OpTaskState[]; includeOpen: boolean } | undefined => {
  if (!Array.isArray(value)) return undefined;
  const parsedStates: OpTaskState[] = [];
  let includeOpen = false;
  for (const entry of value) {
    if (entry === "open") {
      includeOpen = true;
      continue;
    }
    const parsed = parseOpTaskState(entry);
    if (parsed) parsedStates.push(parsed);
  }
  if (parsedStates.length === 0 && !includeOpen) return undefined;
  return { states: parsedStates, includeOpen };
};

const parseOpTaskPriorities = (value: unknown): OpTaskPriority[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const parsed = value
    .map(parseOpTaskPriority)
    .filter((priority): priority is OpTaskPriority => Boolean(priority));
  return parsed.length > 0 ? parsed : undefined;
};

const normalizeMaintenancePriority = (value: unknown): MaintenancePriority => {
  switch (value) {
    case MaintenancePriority.low:
    case MaintenancePriority.medium:
    case MaintenancePriority.high:
    case MaintenancePriority.critical:
      return value;
    default:
      return MaintenancePriority.medium;
  }
};

// Tool argument schemas
const toolArgSchemas: Record<string, z.ZodSchema> = {
  check_availability: z.object({
    arrivalDate: dateStringSchema,
    departureDate: dateStringSchema,
    guests: z.number().int().positive().optional(),
    siteType: z.enum(['rv', 'tent', 'cabin']).optional(),
    confirmed: z.boolean().optional(),
  }),
  get_quote: z.object({
    siteId: z.string().min(1, 'Site ID is required'),
    arrivalDate: dateStringSchema,
    departureDate: dateStringSchema,
    guests: z.number().int().positive().optional(),
    confirmed: z.boolean().optional(),
  }),
  get_activities: z.object({
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    reservationId: z.string().optional(),
    confirmed: z.boolean().optional(),
  }),
  search_reservations: z.object({
    query: z.string().optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']).optional(),
  }).optional(),
  get_reservation: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
  }),
  check_in_guest: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
    confirmed: z.boolean().optional(),
  }),
  check_out_guest: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
    confirmed: z.boolean().optional(),
  }),
  get_balance: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
  }),
  get_occupancy: z.object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    confirmed: z.boolean().optional(),
  }),
  get_revenue_report: z.object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    confirmed: z.boolean().optional(),
  }),
  create_hold: z.object({
    siteId: z.string().min(1, 'Site ID is required'),
    arrivalDate: dateStringSchema,
    departureDate: dateStringSchema,
    holdMinutes: z.number().int().positive().max(24 * 60).optional(),
    note: z.string().optional(),
  }),
  release_hold: z.object({
    holdId: z.string().min(1, 'Hold ID is required'),
  }),
  list_holds: z.object({}).optional(),
  block_site: z.object({
    siteId: z.string().min(1, 'Site ID is required'),
    reason: z.string().min(1, 'Reason is required'),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
  }),
  apply_discount: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
    discountCents: z.number().int().positive().optional(),
    discountPercent: z.number().positive().max(100).optional(),
    reason: z.string().min(1, 'Reason is required'),
  }).refine(
    data => data.discountCents || data.discountPercent,
    'Either discountCents or discountPercent is required'
  ),
  add_charge: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
    amountCents: z.number().int().positive('Amount must be positive'),
    description: z.string().min(1, 'Description is required'),
  }),
  move_reservation: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
    newSiteId: z.string().min(1, 'New site ID is required'),
    reason: z.string().optional(),
  }),
  extend_stay: z.object({
    reservationId: z.string().min(1, 'Reservation ID is required'),
    additionalNights: z.number().int().positive().optional(),
    newDepartureDate: dateStringSchema.optional(),
  }).refine(
    data => data.additionalNights || data.newDepartureDate,
    'Either additionalNights or newDepartureDate is required'
  ),
  request_reservation_change: z.object({
    reservationId: z.string().optional(),
    changeType: z.string().optional(),
    newArrivalDate: dateStringSchema.optional(),
    newDepartureDate: dateStringSchema.optional(),
    newSiteId: z.string().optional(),
    newSiteType: z.string().optional(),
    partySize: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),
  get_tasks: z.object({
    state: opTaskStateFilterSchema.optional(),
    states: z.array(opTaskStateFilterSchema).optional(),
    priority: opTaskPrioritySchema.optional(),
    priorities: z.array(opTaskPrioritySchema).optional(),
    siteId: z.string().optional(),
    assignedToUserId: z.string().optional(),
    limit: z.number().int().positive().max(50).optional(),
  }),
};

interface ChatContext {
  campgroundId: string;
  participantType: ChatParticipantType;
  participantId: string;
  role?: string;
  currentReservationId?: string;
}

interface PreValidateResult {
  valid: boolean;
  message?: string; // Error message if invalid
  [key: string]: unknown; // Additional data to pass to execute
}

type JsonRenderElement = {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  parentKey?: string | null;
  visible?: unknown;
};

type JsonRenderTree = {
  root: string;
  elements: Record<string, JsonRenderElement>;
};

type JsonRenderPayload = {
  title: string;
  summary?: string;
  tree: JsonRenderTree;
  data: Record<string, unknown>;
};

const buildJsonRenderTree = (root: string, elements: JsonRenderElement[]): JsonRenderTree => {
  const elementMap: Record<string, JsonRenderElement> = {};
  for (const element of elements) {
    elementMap[element.key] = element;
  }
  return { root, elements: elementMap };
};

const AUDIT_REDACT_KEYS = new Set(['message', 'notes', 'description', 'content']);
const sanitizeAuditValue = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') {
    return value.length > 180 ? `${value.slice(0, 180)}...` : value;
  }
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => sanitizeAuditValue(entry, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (AUDIT_REDACT_KEYS.has(key)) {
      result[key] = typeof entry === 'string' ? '[redacted]' : entry;
      continue;
    }
    result[key] = sanitizeAuditValue(entry, depth + 1);
  }
  return result;
};

type AuditConfig = {
  action: string;
  entity: string;
  resolveEntityId: (args: Record<string, unknown>, result: unknown) => string | undefined;
};

const AUDITED_TOOL_ACTIONS: Record<string, AuditConfig> = {
  check_in_guest: {
    action: 'reservation.check_in',
    entity: 'reservation',
    resolveEntityId: (args, result) => {
      const reservation = isRecord(result) && isRecord(result.reservation) ? result.reservation : undefined;
      return getString(reservation?.id) ?? getString(args.reservationId);
    },
  },
  check_out_guest: {
    action: 'reservation.check_out',
    entity: 'reservation',
    resolveEntityId: (args, result) => {
      const reservation = isRecord(result) && isRecord(result.reservation) ? result.reservation : undefined;
      return getString(reservation?.id) ?? getString(args.reservationId);
    },
  },
  apply_discount: {
    action: 'reservation.discount',
    entity: 'reservation',
    resolveEntityId: (args) => getString(args.reservationId),
  },
  add_charge: {
    action: 'reservation.charge',
    entity: 'reservation',
    resolveEntityId: (args) => getString(args.reservationId),
  },
  move_reservation: {
    action: 'reservation.move',
    entity: 'reservation',
    resolveEntityId: (args) => getString(args.reservationId),
  },
  extend_stay: {
    action: 'reservation.extend',
    entity: 'reservation',
    resolveEntityId: (args) => getString(args.reservationId),
  },
  request_early_checkin: {
    action: 'reservation.request_early_checkin',
    entity: 'reservation',
    resolveEntityId: (args, result) => {
      const request = isRecord(result) && isRecord(result.request) ? result.request : undefined;
      return getString(request?.reservationId) ?? getString(args.reservationId);
    },
  },
  request_late_checkout: {
    action: 'reservation.request_late_checkout',
    entity: 'reservation',
    resolveEntityId: (args, result) => {
      const request = isRecord(result) && isRecord(result.request) ? result.request : undefined;
      return getString(request?.reservationId) ?? getString(args.reservationId);
    },
  },
  request_reservation_change: {
    action: 'reservation.request_change',
    entity: 'reservation',
    resolveEntityId: (args, result) => {
      const request = isRecord(result) && isRecord(result.request) ? result.request : undefined;
      return getString(request?.reservationId) ?? getString(args.reservationId);
    },
  },
  block_site: {
    action: 'site.block',
    entity: 'site',
    resolveEntityId: (args) => getString(args.siteId),
  },
  unblock_site: {
    action: 'site.unblock',
    entity: 'site',
    resolveEntityId: (args) => getString(args.siteId),
  },
  create_maintenance_ticket: {
    action: 'maintenance_ticket.create',
    entity: 'maintenance_ticket',
    resolveEntityId: (args, result) => {
      const ticket = isRecord(result) && isRecord(result.ticket) ? result.ticket : undefined;
      return getString(ticket?.id) ?? getString(args.ticketId);
    },
  },
  send_message_to_staff: {
    action: 'message.send_staff',
    entity: 'message',
    resolveEntityId: (args, result) => getString(isRecord(result) ? result.messageId : undefined),
  },
  send_guest_message: {
    action: 'message.send_guest',
    entity: 'message',
    resolveEntityId: (args, result) => getString(isRecord(result) ? result.messageId : undefined),
  },
};
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  guestAllowed: boolean;
  staffRoles?: string[]; // If not specified, all staff can use
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  // Pre-validate before showing confirmation dialog - can fail early with helpful message
  preValidate?: (args: Record<string, unknown>, context: ChatContext, prisma: PrismaService) => Promise<PreValidateResult>;
  execute: (args: Record<string, unknown>, context: ChatContext, prisma: PrismaService) => Promise<unknown>;
}

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name);
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly holds: HoldsService,
    private readonly privacy: AiPrivacyService,
  ) {
    this.registerTools();
  }

  /**
   * Register all available tools
   */
  private registerTools() {
    // ============ TIER 1: Core Operations ============

    // Check availability
    this.tools.set('check_availability', {
      name: 'check_availability',
      description: 'Check available sites for a date range. Returns list of available sites with pricing.',
      parameters: {
        type: 'object',
        properties: {
          arrivalDate: { type: 'string', description: 'Arrival date (YYYY-MM-DD)' },
          departureDate: { type: 'string', description: 'Departure date (YYYY-MM-DD)' },
          guests: { type: 'number', description: 'Number of guests (optional)' },
          siteType: { type: 'string', description: 'Site type filter: rv, tent, cabin (optional)' },
          confirmed: { type: 'boolean', description: 'Set true after confirming far-future or cross-year dates' },
        },
        required: ['arrivalDate', 'departureDate'],
      },
      guestAllowed: true,
      preValidate: async (args) => {
        const arrivalDate = getString(args.arrivalDate);
        const departureDate = getString(args.departureDate);
        const confirmed = getBoolean(args.confirmed);
        const confirmationError = getDateConfirmationError(arrivalDate, departureDate, confirmed);
        if (confirmationError) {
          return { valid: false, message: confirmationError };
        }
        return { valid: true };
      },
      execute: async (args, context, prisma) => {
        const arrivalDate = getString(args.arrivalDate);
        const departureDate = getString(args.departureDate);
        const guests = getNumber(args.guests);
        const siteType = parseSiteType(args.siteType);

        if (!arrivalDate || !departureDate) {
          throw new BadRequestException('Arrival and departure dates are required');
        }

        // Get all sites for this campground
        const sites = await prisma.site.findMany({
          where: {
            campgroundId: context.campgroundId,
            status: 'active',
            ...(siteType && { siteType }),
          },
          include: {
            SiteClass: true,
          },
        });

        // Find reservations that overlap with the requested dates
        const conflictingReservations = await prisma.reservation.findMany({
          where: {
            campgroundId: context.campgroundId,
            status: { in: ['pending', 'confirmed', 'checked_in'] },
            OR: [
              {
                arrivalDate: { lte: new Date(departureDate) },
                departureDate: { gt: new Date(arrivalDate) },
              },
            ],
          },
          select: { siteId: true },
        });

        const bookedSiteIds = new Set(conflictingReservations.map(r => r.siteId).filter(Boolean));

        // Filter to available sites
        const availableSites = sites.filter(s => !bookedSiteIds.has(s.id));

        if (process.env.NODE_ENV === "staging") {
          this.logger.log(
            `check_availability summary: arrival=${arrivalDate} departure=${departureDate} guests=${guests ?? "n/a"} siteType=${siteType ?? "any"} totalSites=${sites.length} bookedSites=${bookedSiteIds.size} available=${availableSites.length}`
          );
        }

        // Calculate nights
        const arrival = new Date(arrivalDate);
        const departure = new Date(departureDate);
        const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));

        return {
          success: true,
          availableSites: availableSites.slice(0, 10).map(s => {
            const baseRateCents = s.SiteClass?.defaultRate;
            const hasRate = typeof baseRateCents === "number" && baseRateCents > 0;
            return {
              id: s.id,
              name: s.name,
              type: s.siteType,
              className: s.SiteClass?.name,
              maxGuests: s.maxOccupancy,
              pricePerNight: hasRate ? `$${(baseRateCents / 100).toFixed(2)}` : 'Contact for pricing',
              totalEstimate: hasRate ? `$${((baseRateCents * nights) / 100).toFixed(2)}` : null,
              amenities: s.amenityTags || [],
            };
          }),
          totalAvailable: availableSites.length,
          nights,
          message: availableSites.length > 0
            ? `Found ${availableSites.length} available sites for ${nights} night${nights > 1 ? 's' : ''}`
            : 'No sites available for the selected dates',
        };
      },
    });

    // Get quote
    this.tools.set('get_quote', {
      name: 'get_quote',
      description: 'Get a price quote for a specific site and date range.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID or name' },
          arrivalDate: { type: 'string', description: 'Arrival date (YYYY-MM-DD)' },
          departureDate: { type: 'string', description: 'Departure date (YYYY-MM-DD)' },
          guests: { type: 'number', description: 'Number of guests' },
          confirmed: { type: 'boolean', description: 'Set true after confirming far-future or cross-year dates' },
        },
        required: ['siteId', 'arrivalDate', 'departureDate'],
      },
      guestAllowed: true,
      // Pre-validate site exists and resolve name to ID
      preValidate: async (args, context, prisma) => {
        const arrivalDate = getString(args.arrivalDate);
        const departureDate = getString(args.departureDate);
        const confirmed = getBoolean(args.confirmed);
        const confirmationError = getDateConfirmationError(arrivalDate, departureDate, confirmed);
        if (confirmationError) {
          return { valid: false, message: confirmationError };
        }

        const siteId = getString(args.siteId);
        if (!siteId) {
          return { valid: false, message: 'Site ID is required.' };
        }

        // Try to find the site by ID first
        let site = await prisma.site.findFirst({
          where: { id: siteId, campgroundId: context.campgroundId },
          include: { SiteClass: true },
        });

        // If not found by ID, try to find by name
        if (!site) {
          site = await prisma.site.findFirst({
            where: {
              campgroundId: context.campgroundId,
              OR: [
                { name: siteId },
                { name: `Site ${siteId}` },
                { name: { contains: siteId, mode: 'insensitive' } },
              ],
            },
            include: { SiteClass: true },
          });
        }

        if (!site) {
          // Get available sites to suggest alternatives
          const availableSites = await prisma.site.findMany({
            where: { campgroundId: context.campgroundId, status: 'active' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
            take: 15,
          });

          const siteNames = availableSites.map(s => s.name).join(', ');
          return {
            valid: false,
            message: `Site "${siteId}" was not found. Available sites: ${siteNames}. Please specify a valid site name.`,
          };
        }

        // Update args with resolved site ID
        args.siteId = site.id;
        return { valid: true, siteName: site.name };
      },
      execute: async (args, context, prisma) => {
        const siteId = getString(args.siteId);
        const arrivalDate = getString(args.arrivalDate);
        const departureDate = getString(args.departureDate);
        const guests = getNumber(args.guests) ?? 2;

        if (!siteId || !arrivalDate || !departureDate) {
          throw new BadRequestException('Site ID, arrival date, and departure date are required');
        }

        const site = await prisma.site.findFirst({
          where: { id: siteId, campgroundId: context.campgroundId },
          include: { SiteClass: true },
        });

        if (!site) {
          return { success: false, message: 'Site not found' };
        }

        const arrival = new Date(arrivalDate);
        const departure = new Date(departureDate);
        const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));

        const baseRateCents = site.SiteClass?.defaultRate ?? 0;
        const subtotalCents = baseRateCents * nights;

        // Get campground tax rates
        const campground = await prisma.campground.findUnique({
          where: { id: context.campgroundId },
          select: { taxState: true, taxLocal: true },
        });

        if (!campground) {
          return { success: false, message: 'Campground not found' };
        }

        const taxRate = (Number(campground.taxState || 0) + Number(campground.taxLocal || 0)) / 100;
        const taxCents = Math.round(subtotalCents * taxRate);
        const totalCents = subtotalCents + taxCents;

        // Get site lock fee from site class (if campground charges one)
        const siteLockFeeCents = site.SiteClass?.siteLockFeeCents ?? 0;

        // Build response - only mention site lock fee if campground actually charges one
        const isGuest = context.participantType === ChatParticipantType.guest;
        let siteNote = '';
        let canGuaranteeSite = true;

        if (isGuest && site.SiteClass && siteLockFeeCents > 0) {
          // Campground charges a site lock fee - let guest know
          siteNote = `\n\nNote: Bookings guarantee the site class (${site.SiteClass.name}) but not a specific site. To guarantee ${site.name}, add the site lock fee of $${(siteLockFeeCents / 100).toFixed(2)}.`;
          canGuaranteeSite = false;
        }
        // If no site lock fee, guest can book the specific site directly - no note needed

        return {
          success: true,
          quote: {
            site: site.name,
            siteClass: site.SiteClass?.name,
            arrivalDate,
            departureDate,
            nights,
            guests,
            breakdown: {
              nightly: `$${(baseRateCents / 100).toFixed(2)}`,
              subtotal: `$${(subtotalCents / 100).toFixed(2)}`,
              tax: `$${(taxCents / 100).toFixed(2)}`,
              total: `$${(totalCents / 100).toFixed(2)}`,
            },
            totalCents,
            // Only include site lock info if campground charges for it
            siteLockFee: siteLockFeeCents > 0 ? `$${(siteLockFeeCents / 100).toFixed(2)}` : null,
            canGuaranteeSpecificSite: canGuaranteeSite,
            siteClassGuaranteeNote: (isGuest && siteLockFeeCents > 0)
              ? `Bookings guarantee the ${site.SiteClass?.name} class, not a specific site. Add $${(siteLockFeeCents / 100).toFixed(2)} site lock fee to guarantee ${site.name}.`
              : null,
          },
          message: `Quote for ${site.name}: ${nights} night${nights > 1 ? 's' : ''} = $${(totalCents / 100).toFixed(2)} total${siteNote}`,
        };
      },
    });

    // Search reservations
    this.tools.set('search_reservations', {
      name: 'search_reservations',
      description: 'Search for reservations by guest name, confirmation code, or date range.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term (name, email, confirmation code)' },
          startDate: { type: 'string', description: 'Start date filter (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date filter (YYYY-MM-DD)' },
          status: { type: 'string', description: 'Status filter: pending, confirmed, checked_in, checked_out, cancelled' },
        },
        required: [],
      },
      guestAllowed: false, // Guests use get_my_reservations instead
      execute: async (args, context, prisma) => {
        const query = getString(args.query);
        const startDate = getString(args.startDate);
        const endDate = getString(args.endDate);
        const status = parseReservationStatus(args.status);

        const where: Prisma.ReservationWhereInput = { campgroundId: context.campgroundId };

        if (query) {
          where.OR = [
            { id: { contains: query, mode: 'insensitive' } },
            { Guest: { primaryFirstName: { contains: query, mode: 'insensitive' } } },
            { Guest: { primaryLastName: { contains: query, mode: 'insensitive' } } },
            { Guest: { email: { contains: query, mode: 'insensitive' } } },
          ];
        }

        if (startDate) {
          where.arrivalDate = { gte: new Date(startDate) };
        }
        if (endDate) {
          where.departureDate = { lte: new Date(endDate) };
        }
        if (status) {
          where.status = status;
        }

        const reservations = await prisma.reservation.findMany({
          where,
          include: {
            Guest: { select: { primaryFirstName: true, primaryLastName: true, email: true, phone: true } },
            Site: { select: { name: true } },
          },
          orderBy: { arrivalDate: 'asc' },
          take: 10,
        });

        return {
          success: true,
          reservations: reservations.map(r => ({
            id: r.id,
            confirmationCode: r.id,
            guestName: r.Guest ? `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}` : 'Unknown',
            guestEmail: r.Guest?.email,
            site: r.Site?.name,
            arrival: r.arrivalDate.toISOString().split('T')[0],
            departure: r.departureDate.toISOString().split('T')[0],
            status: r.status,
            balance: `$${(r.balanceAmount / 100).toFixed(2)}`,
          })),
          count: reservations.length,
          message: `Found ${reservations.length} reservation${reservations.length !== 1 ? 's' : ''}`,
        };
      },
    });

    // Get reservation details
    this.tools.set('get_reservation', {
      name: 'get_reservation',
      description: 'Get detailed information about a specific reservation.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID or confirmation code' },
        },
        required: ['reservationId'],
      },
      guestAllowed: true, // But scoped to their own reservations
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const where: Prisma.ReservationWhereInput = {
          campgroundId: context.campgroundId,
          OR: [{ id: reservationId }],
        };

        // Guests can only see their own reservations
        if (context.participantType === ChatParticipantType.guest) {
          where.guestId = context.participantId;
        }

        const reservation = await prisma.reservation.findFirst({
          where,
          include: {
            Guest: { select: { primaryFirstName: true, primaryLastName: true, email: true, phone: true } },
            Site: { select: { name: true, SiteClass: { select: { name: true } } } },
            Payment: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        return {
          success: true,
          reservation: {
            id: reservation.id,
            confirmationCode: reservation.id,
            status: reservation.status,
            guest: reservation.Guest ? {
              name: `${reservation.Guest.primaryFirstName} ${reservation.Guest.primaryLastName}`,
              email: reservation.Guest.email,
              phone: reservation.Guest.phone,
            } : null,
            site: reservation.Site?.name,
            siteClass: reservation.Site?.SiteClass?.name,
            arrival: reservation.arrivalDate.toISOString().split('T')[0],
            departure: reservation.departureDate.toISOString().split('T')[0],
            nights: Math.ceil((reservation.departureDate.getTime() - reservation.arrivalDate.getTime()) / (1000 * 60 * 60 * 24)),
            guests: reservation.adults + reservation.children,
            totals: {
              subtotal: `$${(reservation.baseSubtotal / 100).toFixed(2)}`,
              tax: `$${(reservation.taxesAmount / 100).toFixed(2)}`,
              fees: `$${(reservation.feesAmount / 100).toFixed(2)}`,
              total: `$${(reservation.totalAmount / 100).toFixed(2)}`,
              paid: `$${(reservation.paidAmount / 100).toFixed(2)}`,
              balance: `$${(reservation.balanceAmount / 100).toFixed(2)}`,
            },
            recentPayments: reservation.Payment.map(p => ({
              amount: `$${(p.amountCents / 100).toFixed(2)}`,
              method: p.method,
              status: p.direction,
              date: p.createdAt.toISOString().split('T')[0],
            })),
          },
        };
      },
    });

    // Get my reservations (guest-specific)
    this.tools.set('get_my_reservations', {
      name: 'get_my_reservations',
      description: 'Get list of reservations for the current guest.',
      parameters: {
        type: 'object',
        properties: {
          includeHistory: { type: 'boolean', description: 'Include past reservations' },
        },
        required: [],
      },
      guestAllowed: true,
      staffRoles: [], // Staff don't use this
      execute: async (args, context, prisma) => {
        if (context.participantType !== ChatParticipantType.guest) {
          return { success: false, message: 'This tool is for guests only' };
        }

        const includeHistory = getBoolean(args.includeHistory) ?? false;

        const where: Prisma.ReservationWhereInput = {
          campgroundId: context.campgroundId,
          guestId: context.participantId,
        };

        if (!includeHistory) {
          where.status = { in: ['pending', 'confirmed', 'checked_in'] };
        }

        const reservations = await prisma.reservation.findMany({
          where,
          include: {
            Site: { select: { name: true } },
          },
          orderBy: { arrivalDate: 'desc' },
          take: 10,
        });

        return {
          success: true,
          reservations: reservations.map(r => ({
            id: r.id,
            confirmationCode: r.id,
            site: r.Site?.name,
            arrival: r.arrivalDate.toISOString().split('T')[0],
            departure: r.departureDate.toISOString().split('T')[0],
            status: r.status,
            balance: `$${(r.balanceAmount / 100).toFixed(2)}`,
          })),
          message: `You have ${reservations.length} reservation${reservations.length !== 1 ? 's' : ''}`,
        };
      },
    });

    // ============ TIER 2: Guest Self-Service ============

    // Get campground info
    this.tools.set('get_campground_info', {
      name: 'get_campground_info',
      description: 'Get information about the campground (hours, policies, amenities, contact).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      guestAllowed: true,
      execute: async (args, context, prisma) => {
        const campground = await prisma.campground.findUnique({
          where: { id: context.campgroundId },
          select: {
            name: true,
            description: true,
            address1: true,
            city: true,
            state: true,
            postalCode: true,
            phone: true,
            email: true,
            website: true,
            checkInTime: true,
            checkOutTime: true,
            amenities: true,
            cancellationPolicyType: true,
            cancellationNotes: true,
          },
        });

        if (!campground) {
          return { success: false, message: 'Campground not found' };
        }

        return {
          success: true,
          campground: {
            name: campground.name,
            description: campground.description,
            address: `${campground.address1}, ${campground.city}, ${campground.state} ${campground.postalCode}`,
            contact: {
              phone: campground.phone,
              email: campground.email,
              website: campground.website,
            },
            policies: {
              checkIn: campground.checkInTime || '3:00 PM',
              checkOut: campground.checkOutTime || '11:00 AM',
              cancellation: campground.cancellationPolicyType || 'Standard',
              cancellationNotes: campground.cancellationNotes,
            },
            amenities: campground.amenities || [],
          },
        };
      },
    });

    // ============ TIER 3: Staff Operations ============

    // Get today's arrivals
    this.tools.set('get_arrivals_today', {
      name: 'get_arrivals_today',
      description: 'Get list of guests arriving today.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      guestAllowed: false,
      execute: async (args, context, prisma) => {
        // Get campground timezone for accurate "today" calculation
        const campground = await prisma.campground.findUnique({
          where: { id: context.campgroundId },
          select: { timezone: true }
        });
        const tz = campground?.timezone || "America/Chicago";
        const { todayStart, todayEnd } = getTodayInTimezone(tz);

        const arrivals = await prisma.reservation.findMany({
          where: {
            campgroundId: context.campgroundId,
            arrivalDate: { gte: todayStart, lt: todayEnd },
            status: { in: ['pending', 'confirmed'] },
          },
          include: {
            Guest: { select: { primaryFirstName: true, primaryLastName: true, phone: true } },
            Site: { select: { name: true } },
          },
          orderBy: { arrivalDate: 'asc' },
        });

        return {
          success: true,
          arrivals: arrivals.map(r => ({
            id: r.id,
            confirmationCode: r.id,
            guestName: r.Guest ? `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}` : 'Unknown',
            phone: r.Guest?.phone,
            site: r.Site?.name,
            balance: `$${(r.balanceAmount / 100).toFixed(2)}`,
            status: r.status,
          })),
          count: arrivals.length,
          message: `${arrivals.length} arrival${arrivals.length !== 1 ? 's' : ''} today`,
        };
      },
    });

    // Get today's departures
    this.tools.set('get_departures_today', {
      name: 'get_departures_today',
      description: 'Get list of guests departing today.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      guestAllowed: false,
      execute: async (args, context, prisma) => {
        // Get campground timezone for accurate "today" calculation
        const campground = await prisma.campground.findUnique({
          where: { id: context.campgroundId },
          select: { timezone: true }
        });
        const tz = campground?.timezone || "America/Chicago";
        const { todayStart, todayEnd } = getTodayInTimezone(tz);

        const departures = await prisma.reservation.findMany({
          where: {
            campgroundId: context.campgroundId,
            departureDate: { gte: todayStart, lt: todayEnd },
            status: 'checked_in',
          },
          include: {
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
            Site: { select: { name: true } },
          },
          orderBy: { departureDate: 'asc' },
        });

        return {
          success: true,
          departures: departures.map(r => ({
            id: r.id,
            confirmationCode: r.id,
            guestName: r.Guest ? `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}` : 'Unknown',
            site: r.Site?.name,
            balance: `$${(r.balanceAmount / 100).toFixed(2)}`,
          })),
          count: departures.length,
          message: `${departures.length} departure${departures.length !== 1 ? 's' : ''} today`,
        };
      },
    });

    // Get open tasks
    this.tools.set('get_tasks', {
      name: 'get_tasks',
      description: 'Get a list of open operational tasks.',
      parameters: {
        type: 'object',
        properties: {
          state: { type: 'string', description: "Task state filter (optional). Use 'open' for pending/assigned/in_progress/blocked." },
          states: { type: 'array', items: { type: 'string' }, description: "Task states filter (optional). Supports 'open' alias." },
          priority: { type: 'string', description: 'Priority filter (optional)' },
          priorities: { type: 'array', items: { type: 'string' }, description: 'Priority filters (optional)' },
          siteId: { type: 'string', description: 'Site ID filter (optional)' },
          assignedToUserId: { type: 'string', description: 'Assigned user ID filter (optional)' },
          limit: { type: 'number', description: 'Max tasks to return (optional, default 10)' },
        },
        required: [],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk', 'maintenance'],
      execute: async (args, context, prisma) => {
        const limit = Math.min(getNumber(args.limit) ?? 10, 50);
        const state = parseOpTaskStateFilter(args.state);
        const states = parseOpTaskStateFilters(args.states);
        const priority = parseOpTaskPriority(args.priority);
        const priorities = parseOpTaskPriorities(args.priorities);
        const siteId = getString(args.siteId);
        const assignedToUserId = getString(args.assignedToUserId);

        const openStates = [
          OpTaskState.pending,
          OpTaskState.assigned,
          OpTaskState.in_progress,
          OpTaskState.blocked,
        ];

        let stateFilter: Prisma.OpTaskWhereInput["state"];
        if (states) {
          const combined = new Set<OpTaskState>(states.states);
          if (states.includeOpen) {
            openStates.forEach((entry) => combined.add(entry));
          }
          const combinedStates = Array.from(combined);
          stateFilter = combinedStates.length > 0 ? { in: combinedStates } : { in: openStates };
        } else if (state === "open") {
          stateFilter = { in: openStates };
        } else if (state) {
          stateFilter = state;
        } else {
          stateFilter = { in: openStates };
        }
        const priorityFilter: Prisma.OpTaskWhereInput["priority"] = priorities
          ? { in: priorities }
          : priority
            ? priority
            : undefined;

        type OpTaskWithRelations = Prisma.OpTaskGetPayload<{
          include: {
            Site: { select: { name: true; siteNumber: true } };
            User_OpTask_assignedToUserIdToUser: { select: { id: true; firstName: true; lastName: true } };
          };
        }>;

        const tasks: OpTaskWithRelations[] = await prisma.opTask.findMany({
          where: {
            campgroundId: context.campgroundId,
            state: stateFilter,
            priority: priorityFilter,
            siteId: siteId ?? undefined,
            assignedToUserId: assignedToUserId ?? undefined,
          },
          include: {
            Site: { select: { name: true, siteNumber: true } },
            User_OpTask_assignedToUserIdToUser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ slaDueAt: 'asc' }, { createdAt: 'desc' }],
          take: limit,
        });

        return {
          success: true,
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title,
            state: task.state,
            priority: task.priority,
            dueAt: task.slaDueAt?.toISOString(),
            site: task.Site?.name || task.Site?.siteNumber || null,
            reservationId: task.reservationId,
            assignedTo: task.User_OpTask_assignedToUserIdToUser
              ? `${task.User_OpTask_assignedToUserIdToUser.firstName} ${task.User_OpTask_assignedToUserIdToUser.lastName}`
              : null,
          })),
          count: tasks.length,
          message: `${tasks.length} open task${tasks.length !== 1 ? 's' : ''}`,
        };
      },
    });

    // Check-in guest (requires confirmation)
    this.tools.set('check_in_guest', {
      name: 'check_in_guest',
      description: 'Check in a guest. Marks their reservation as checked in.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID or confirmation code' },
          confirmed: { type: 'boolean', description: 'Whether the action has been confirmed' },
        },
        required: ['reservationId'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Check-In',
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: {
            campgroundId: context.campgroundId,
            OR: [{ id: reservationId }],
          },
          include: {
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
            Site: { select: { name: true } },
          },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        if (reservation.status !== 'confirmed' && reservation.status !== 'pending') {
          return { success: false, message: `Cannot check in: reservation is ${reservation.status}` };
        }

        const updated = await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: 'checked_in', checkInAt: new Date() },
        });

        return {
          success: true,
          message: `Checked in ${reservation.Guest?.primaryFirstName} ${reservation.Guest?.primaryLastName} to ${reservation.Site?.name}`,
          reservation: {
            id: updated.id,
            confirmationCode: updated.id,
            status: updated.status,
          },
        };
      },
    });

    // Check-out guest (requires confirmation)
    this.tools.set('check_out_guest', {
      name: 'check_out_guest',
      description: 'Check out a guest. Marks their reservation as checked out.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID or confirmation code' },
          confirmed: { type: 'boolean', description: 'Whether the action has been confirmed' },
        },
        required: ['reservationId'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Check-Out',
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: {
            campgroundId: context.campgroundId,
            OR: [{ id: reservationId }],
          },
          include: {
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
            Site: { select: { name: true } },
          },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        if (reservation.status !== 'checked_in') {
          return { success: false, message: `Cannot check out: reservation is ${reservation.status}` };
        }

        // Check for outstanding balance
        if (reservation.balanceAmount > 0) {
          return {
            success: false,
            message: `Outstanding balance of $${(reservation.balanceAmount / 100).toFixed(2)}. Collect payment before checkout.`,
            balance: reservation.balanceAmount,
          };
        }

        const updated = await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: 'checked_out', checkOutAt: new Date() },
        });

        return {
          success: true,
          message: `Checked out ${reservation.Guest?.primaryFirstName} ${reservation.Guest?.primaryLastName} from ${reservation.Site?.name}`,
          reservation: {
            id: updated.id,
            confirmationCode: updated.id,
            status: updated.status,
          },
        };
      },
    });

    // Get balance for reservation
    this.tools.set('get_balance', {
      name: 'get_balance',
      description: 'Get the balance due for a reservation.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID or confirmation code' },
        },
        required: ['reservationId'],
      },
      guestAllowed: true, // But scoped
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const where: Prisma.ReservationWhereInput = {
          campgroundId: context.campgroundId,
          OR: [{ id: reservationId }],
        };

        if (context.participantType === ChatParticipantType.guest) {
          where.guestId = context.participantId;
        }

        const reservation = await prisma.reservation.findFirst({
          where,
          select: {
            id: true,
            totalAmount: true,
            balanceAmount: true,
            paidAmount: true,
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        const paid = reservation.paidAmount;

        return {
          success: true,
          balance: {
            total: `$${(reservation.totalAmount / 100).toFixed(2)}`,
            paid: `$${(paid / 100).toFixed(2)}`,
            due: `$${(reservation.balanceAmount / 100).toFixed(2)}`,
          },
          message: reservation.balanceAmount > 0
            ? `Balance due: $${(reservation.balanceAmount / 100).toFixed(2)}`
            : 'Reservation is fully paid',
        };
      },
    });

    // ============ TIER 2: Guest Self-Service (Additional) ============

    // Get activities/events during stay
    this.tools.set('get_activities', {
      name: 'get_activities',
      description: 'Get activities and events happening during a date range or stay.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          reservationId: { type: 'string', description: 'Reservation ID to get events during stay (alternative to dates)' },
          confirmed: { type: 'boolean', description: 'Set true after confirming far-future or cross-year dates' },
        },
        required: [],
      },
      guestAllowed: true,
      preValidate: async (args) => {
        const reservationId = getString(args.reservationId);
        if (reservationId) {
          return { valid: true };
        }
        const startDate = getString(args.startDate);
        const endDate = getString(args.endDate);
        const confirmed = getBoolean(args.confirmed);
        const confirmationError = getDateConfirmationError(startDate, endDate, confirmed);
        if (confirmationError) {
          return { valid: false, message: confirmationError };
        }
        return { valid: true };
      },
      execute: async (args, context, prisma) => {
        let startDate: Date;
        let endDate: Date;

        const reservationId = getString(args.reservationId);
        if (reservationId) {
          const reservation = await prisma.reservation.findFirst({
            where: {
              campgroundId: context.campgroundId,
              OR: [{ id: reservationId }],
            },
          });
          if (!reservation) {
            return { success: false, message: 'Reservation not found' };
          }
          startDate = reservation.arrivalDate;
          endDate = reservation.departureDate;
        } else {
          const startDateInput = getString(args.startDate);
          const endDateInput = getString(args.endDate);
          startDate = startDateInput ? new Date(startDateInput) : new Date();
          endDate = endDateInput ? new Date(endDateInput) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        const events = await prisma.event.findMany({
          where: {
            campgroundId: context.campgroundId,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
            isPublished: true,
            isCancelled: false,
          },
          orderBy: { startDate: 'asc' },
          take: 20,
        });

        return {
          success: true,
          events: events.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description,
            startDate: e.startDate.toISOString().split('T')[0],
            endDate: e.endDate?.toISOString().split('T')[0],
            location: e.location,
            category: e.eventType,
          })),
          count: events.length,
          message: events.length > 0
            ? `Found ${events.length} event${events.length !== 1 ? 's' : ''}`
            : 'No events scheduled during this period',
        };
      },
    });

    // Request early check-in
    this.tools.set('request_early_checkin', {
      name: 'request_early_checkin',
      description: 'Request early check-in for a reservation. Staff will review the request.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID or confirmation code' },
          requestedTime: { type: 'string', description: 'Requested check-in time (e.g., "12:00 PM")' },
          notes: { type: 'string', description: 'Additional notes for the request' },
        },
        required: ['reservationId'],
      },
      guestAllowed: true,
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        const requestedTime = getString(args.requestedTime);
        const notes = getString(args.notes);
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const where: Prisma.ReservationWhereInput = {
          campgroundId: context.campgroundId,
          OR: [{ id: reservationId }],
        };

        if (context.participantType === ChatParticipantType.guest) {
          where.guestId = context.participantId;
        }

        const reservation = await prisma.reservation.findFirst({
          where,
          include: { Guest: true, Site: true },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        // Create a message to staff
        await prisma.message.create({
          data: {
            id: randomUUID(),
            campgroundId: context.campgroundId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            senderType: 'guest',
            content: `Early check-in request for ${reservation.Site?.name || 'site'} on ${reservation.arrivalDate.toISOString().split('T')[0]}.\n\nRequested time: ${requestedTime || 'As early as possible'}\n\nNotes: ${notes || 'None'}`,
          },
        });

        return {
          success: true,
          message: `Early check-in request submitted for ${reservation.arrivalDate.toISOString().split('T')[0]}. The campground staff will review your request and contact you.`,
          request: {
            reservationId: reservation.id,
            requestedTime: requestedTime || 'As early as possible',
            status: 'pending',
          },
        };
      },
    });

    // Request late check-out
    this.tools.set('request_late_checkout', {
      name: 'request_late_checkout',
      description: 'Request late check-out for a reservation. Staff will review the request.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID or confirmation code' },
          requestedTime: { type: 'string', description: 'Requested check-out time (e.g., "2:00 PM")' },
          notes: { type: 'string', description: 'Additional notes for the request' },
        },
        required: ['reservationId'],
      },
      guestAllowed: true,
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        const requestedTime = getString(args.requestedTime);
        const notes = getString(args.notes);
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const where: Prisma.ReservationWhereInput = {
          campgroundId: context.campgroundId,
          OR: [{ id: reservationId }],
        };

        if (context.participantType === ChatParticipantType.guest) {
          where.guestId = context.participantId;
        }

        const reservation = await prisma.reservation.findFirst({
          where,
          include: { Guest: true, Site: true },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        // Create a message to staff
        await prisma.message.create({
          data: {
            id: randomUUID(),
            campgroundId: context.campgroundId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            senderType: 'guest',
            content: `Late check-out request for ${reservation.Site?.name || 'site'} on ${reservation.departureDate.toISOString().split('T')[0]}.\n\nRequested time: ${requestedTime || 'As late as possible'}\n\nNotes: ${notes || 'None'}`,
          },
        });

        return {
          success: true,
          message: `Late check-out request submitted for ${reservation.departureDate.toISOString().split('T')[0]}. The campground staff will review your request and contact you.`,
          request: {
            reservationId: reservation.id,
            requestedTime: requestedTime || 'As late as possible',
            status: 'pending',
          },
        };
      },
    });

    // Request reservation change
    this.tools.set('request_reservation_change', {
      name: 'request_reservation_change',
      description: 'Request changes to a reservation (dates, site, or party size). Staff will review the request.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID or confirmation code (optional if already in context)' },
          changeType: { type: 'string', description: 'Type of change (dates, site, party size, other)' },
          newArrivalDate: { type: 'string', description: 'New arrival date (YYYY-MM-DD)' },
          newDepartureDate: { type: 'string', description: 'New departure date (YYYY-MM-DD)' },
          newSiteId: { type: 'string', description: 'Requested site ID (optional)' },
          newSiteType: { type: 'string', description: 'Requested site type (optional)' },
          partySize: { type: 'number', description: 'New total guest count (optional)' },
          notes: { type: 'string', description: 'Additional notes for staff (optional)' },
        },
        required: [],
      },
      guestAllowed: true,
      execute: async (args, context, prisma) => {
        if (context.participantType !== ChatParticipantType.guest) {
          return { success: false, message: 'This tool is for guests only' };
        }

        const reservationId = getString(args.reservationId) ?? context.currentReservationId;
        const changeType = getString(args.changeType);
        const newArrivalDate = getString(args.newArrivalDate);
        const newDepartureDate = getString(args.newDepartureDate);
        const newSiteId = getString(args.newSiteId);
        const newSiteType = parseSiteType(args.newSiteType);
        const partySize = getNumber(args.partySize);
        const notes = getString(args.notes);

        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: {
            campgroundId: context.campgroundId,
            OR: [{ id: reservationId }],
            guestId: context.participantId,
          },
          include: { Guest: true, Site: true },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        const changeLines = [
          changeType ? `Change type: ${changeType}` : null,
          newArrivalDate ? `New arrival: ${newArrivalDate}` : null,
          newDepartureDate ? `New departure: ${newDepartureDate}` : null,
          newSiteId ? `Requested site: ${newSiteId}` : null,
          newSiteType ? `Requested site type: ${newSiteType}` : null,
          partySize ? `New party size: ${partySize}` : null,
          notes ? `Notes: ${notes}` : null,
        ].filter(Boolean);

        const changeSummary = changeLines.length > 0 ? changeLines.join('\n') : 'No details provided.';

        await prisma.message.create({
          data: {
            id: randomUUID(),
            campgroundId: context.campgroundId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            senderType: 'guest',
            content: `Reservation change request for ${reservation.Site?.name || 'site'} (${reservation.arrivalDate.toISOString().split('T')[0]} - ${reservation.departureDate.toISOString().split('T')[0]}).\n\n${changeSummary}`,
          },
        });

        return {
          success: true,
          message: 'Your reservation change request has been sent to the campground staff. They will follow up shortly.',
          request: {
            reservationId: reservation.id,
            changeType,
            newArrivalDate,
            newDepartureDate,
            newSiteId,
            newSiteType,
            partySize,
            notes: notes ? '[redacted]' : undefined,
            status: 'pending',
          },
        };
      },
    });

    // Send message to staff
    this.tools.set('send_message_to_staff', {
      name: 'send_message_to_staff',
      description: 'Send a message to the campground staff.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message content' },
          reservationId: { type: 'string', description: 'Related reservation ID (optional)' },
          urgent: { type: 'boolean', description: 'Mark as urgent' },
        },
        required: ['message'],
      },
      guestAllowed: true,
      execute: async (args, context, prisma) => {
        if (context.participantType !== ChatParticipantType.guest) {
          return { success: false, message: 'This tool is for guests only' };
        }

        const message = getString(args.message);
        const reservationId = getString(args.reservationId) ?? context.currentReservationId;
        const urgent = getBoolean(args.urgent) ?? false;

        if (!message) {
          throw new BadRequestException('Message is required');
        }
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: {
            campgroundId: context.campgroundId,
            OR: [{ id: reservationId }],
            guestId: context.participantId,
          },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        const created = await prisma.message.create({
          data: {
            id: randomUUID(),
            campgroundId: context.campgroundId,
            reservationId: reservation.id,
            guestId: context.participantId,
            senderType: 'guest',
            content: urgent ? `[URGENT] ${message}` : message,
          },
        });

        return {
          success: true,
          message: 'Your message has been sent to the campground staff. They will respond as soon as possible.',
          messageId: created.id,
        };
      },
    });

    // ============ TIER 3: Staff Operations (Additional) ============

    // Get occupancy stats
    this.tools.set('get_occupancy', {
      name: 'get_occupancy',
      description: 'Get occupancy statistics for a date range.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          confirmed: { type: 'boolean', description: 'Set true after confirming far-future or cross-year dates' },
        },
        required: ['startDate', 'endDate'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager'],
      preValidate: async (args) => {
        const startDate = getString(args.startDate);
        const endDate = getString(args.endDate);
        const confirmed = getBoolean(args.confirmed);
        const confirmationError = getDateConfirmationError(startDate, endDate, confirmed);
        if (confirmationError) {
          return { valid: false, message: confirmationError };
        }
        return { valid: true };
      },
      execute: async (args, context, prisma) => {
        const startDateInput = getString(args.startDate);
        const endDateInput = getString(args.endDate);
        if (!startDateInput || !endDateInput) {
          throw new BadRequestException('Start and end dates are required');
        }
        const start = new Date(startDateInput);
        const end = new Date(endDateInput);

        // Get total sites
        const totalSites = await prisma.site.count({
          where: { campgroundId: context.campgroundId, status: 'active' },
        });

        // Get reservations in range
        const reservations = await prisma.reservation.findMany({
          where: {
            campgroundId: context.campgroundId,
            status: { in: ['confirmed', 'checked_in'] },
            arrivalDate: { lte: end },
            departureDate: { gt: start },
          },
        });

        // Calculate occupancy per day
        const days: { date: string; occupied: number; percentage: number }[] = [];
        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          const occupied = reservations.filter(r => {
            const arrival = r.arrivalDate;
            const departure = r.departureDate;
            return arrival <= current && departure > current;
          }).length;

          days.push({
            date: dateStr,
            occupied,
            percentage: totalSites > 0 ? Math.round((occupied / totalSites) * 100) : 0,
          });

          current.setDate(current.getDate() + 1);
        }

        const avgOccupancy = days.length > 0
          ? Math.round(days.reduce((sum, d) => sum + d.percentage, 0) / days.length)
          : 0;

        const dailyBreakdown = days.slice(0, 14);
        const jsonRender: JsonRenderPayload = {
          title: 'Occupancy Report',
          summary: `Average occupancy ${avgOccupancy}%`,
          tree: buildJsonRenderTree('root', [
            {
              key: 'root',
              type: 'Stack',
              props: { gap: 4 },
              children: ['header', 'metrics', 'chart', 'table'],
            },
            {
              key: 'header',
              type: 'Section',
              props: {
                title: 'Occupancy report',
                description: `${startDateInput} to ${endDateInput}`,
              },
            },
            {
              key: 'metrics',
              type: 'Grid',
              props: { columns: 3, gap: 3 },
              children: ['metric-average', 'metric-sites', 'metric-days'],
            },
            {
              key: 'metric-average',
              type: 'Metric',
              props: {
                label: 'Average occupancy',
                valuePath: '/occupancy/averagePercent',
                format: 'percent',
              },
            },
            {
              key: 'metric-sites',
              type: 'Metric',
              props: {
                label: 'Active sites',
                valuePath: '/occupancy/totalSites',
                format: 'number',
              },
            },
            {
              key: 'metric-days',
              type: 'Metric',
              props: {
                label: 'Days covered',
                valuePath: '/occupancy/days',
                format: 'number',
              },
            },
            {
              key: 'chart',
              type: 'TrendChart',
              props: {
                title: 'Daily occupancy',
                description: 'Percent and occupied sites',
                dataPath: '/dailyBreakdown',
                xKey: 'date',
                series: [
                  { key: 'percentage', color: '#0ea5e9', label: 'Occupancy %' },
                  { key: 'occupied', color: '#22c55e', label: 'Occupied' },
                ],
                chartType: 'line',
                height: 220,
              },
            },
            {
              key: 'table',
              type: 'Table',
              props: {
                title: 'Daily breakdown',
                rowsPath: '/dailyBreakdown',
                columns: [
                  { key: 'date', label: 'Date' },
                  { key: 'occupied', label: 'Occupied', format: 'number' },
                  { key: 'percentage', label: 'Occupancy', format: 'percent' },
                ],
              },
            },
          ]),
          data: {
            occupancy: {
              totalSites,
              averagePercent: avgOccupancy,
              days: dailyBreakdown.length,
              dateRange: { start: startDateInput, end: endDateInput },
            },
            dailyBreakdown,
          },
        };

        return {
          success: true,
          occupancy: {
            totalSites,
            dateRange: { start: startDateInput, end: endDateInput },
            averageOccupancy: `${avgOccupancy}%`,
            dailyBreakdown, // Limit to 14 days
          },
          message: `Average occupancy: ${avgOccupancy}% (${totalSites} total sites)`,
          jsonRender,
        };
      },
    });

    // Get revenue report
    this.tools.set('get_revenue_report', {
      name: 'get_revenue_report',
      description: 'Get revenue statistics for a date range.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          confirmed: { type: 'boolean', description: 'Set true after confirming far-future or cross-year dates' },
        },
        required: ['startDate', 'endDate'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'finance'],
      preValidate: async (args) => {
        const startDate = getString(args.startDate);
        const endDate = getString(args.endDate);
        const confirmed = getBoolean(args.confirmed);
        const confirmationError = getDateConfirmationError(startDate, endDate, confirmed);
        if (confirmationError) {
          return { valid: false, message: confirmationError };
        }
        return { valid: true };
      },
      execute: async (args, context, prisma) => {
        const startDateInput = getString(args.startDate);
        const endDateInput = getString(args.endDate);
        if (!startDateInput || !endDateInput) {
          throw new BadRequestException('Start and end dates are required');
        }
        const start = new Date(startDateInput);
        const end = new Date(endDateInput);

        const payments = await prisma.payment.findMany({
          where: {
            campgroundId: context.campgroundId,
            direction: 'charge',
            createdAt: { gte: start, lte: end },
          },
        });

        const totalRevenue = payments.reduce((sum, p) => sum + p.amountCents, 0);
        const paymentsByMethod: Record<string, number> = {};
        const methodStats: Record<string, { amountCents: number; count: number }> = {};
        for (const payment of payments) {
          const method = payment.method || 'other';
          paymentsByMethod[method] = (paymentsByMethod[method] || 0) + payment.amountCents;
          const current = methodStats[method] ?? { amountCents: 0, count: 0 };
          current.amountCents += payment.amountCents;
          current.count += 1;
          methodStats[method] = current;
        }

        const totalRevenueDollars = totalRevenue / 100;
        const averageTransaction = payments.length > 0 ? totalRevenueDollars / payments.length : 0;
        const byMethodRows = Object.entries(methodStats).map(([method, stats]) => ({
          method,
          amount: stats.amountCents / 100,
          percent: totalRevenue > 0 ? stats.amountCents / totalRevenue : 0,
          count: stats.count,
        }));
        const jsonRender: JsonRenderPayload = {
          title: 'Revenue Report',
          summary: `Total revenue $${totalRevenueDollars.toFixed(2)} (${payments.length} transactions)`,
          tree: buildJsonRenderTree('root', [
            {
              key: 'root',
              type: 'Stack',
              props: { gap: 4 },
              children: ['header', 'metrics', 'chart', 'table'],
            },
            {
              key: 'header',
              type: 'Section',
              props: {
                title: 'Revenue report',
                description: `${startDateInput} to ${endDateInput}`,
              },
            },
            {
              key: 'metrics',
              type: 'Grid',
              props: { columns: 3, gap: 3 },
              children: ['metric-total', 'metric-count', 'metric-average'],
            },
            {
              key: 'metric-total',
              type: 'Metric',
              props: {
                label: 'Total revenue',
                valuePath: '/revenue/total',
                format: 'currency',
              },
            },
            {
              key: 'metric-count',
              type: 'Metric',
              props: {
                label: 'Transactions',
                valuePath: '/revenue/transactionCount',
                format: 'number',
              },
            },
            {
              key: 'metric-average',
              type: 'Metric',
              props: {
                label: 'Avg. transaction',
                valuePath: '/revenue/averageTransaction',
                format: 'currency',
              },
            },
            {
              key: 'chart',
              type: 'TrendChart',
              props: {
                title: 'Revenue by method',
                description: 'Totals by payment method',
                dataPath: '/byMethod',
                xKey: 'method',
                chartType: 'bar',
                series: [{ key: 'amount', color: '#0ea5e9', label: 'Revenue' }],
                height: 220,
              },
            },
            {
              key: 'table',
              type: 'Table',
              props: {
                title: 'Payment method breakdown',
                rowsPath: '/byMethod',
                columns: [
                  { key: 'method', label: 'Method' },
                  { key: 'amount', label: 'Revenue', format: 'currency' },
                  { key: 'percent', label: 'Share', format: 'percent' },
                  { key: 'count', label: 'Count', format: 'number' },
                ],
              },
            },
          ]),
          data: {
            revenue: {
              total: totalRevenueDollars,
              transactionCount: payments.length,
              averageTransaction,
              dateRange: { start: startDateInput, end: endDateInput },
            },
            byMethod: byMethodRows,
          },
        };

        return {
          success: true,
          revenue: {
            total: `$${totalRevenueDollars.toFixed(2)}`,
            transactionCount: payments.length,
            byMethod: Object.fromEntries(
              Object.entries(paymentsByMethod).map(([k, v]) => [k, `$${(v / 100).toFixed(2)}`])
            ),
            dateRange: { start: startDateInput, end: endDateInput },
          },
          message: `Total revenue: $${totalRevenueDollars.toFixed(2)} from ${payments.length} transactions`,
          jsonRender,
        };
      },
    });

    // Create hold
    this.tools.set('create_hold', {
      name: 'create_hold',
      description: 'Place a temporary hold on a site to prevent booking.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID or name' },
          arrivalDate: { type: 'string', description: 'Arrival date (YYYY-MM-DD)' },
          departureDate: { type: 'string', description: 'Departure date (YYYY-MM-DD)' },
          holdMinutes: { type: 'number', description: 'Hold duration in minutes (optional)' },
          note: { type: 'string', description: 'Optional note for the hold' },
        },
        required: ['siteId', 'arrivalDate', 'departureDate'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Hold',
      preValidate: async (args, context, prisma) => {
        const siteId = getString(args.siteId);
        if (!siteId) {
          return { valid: false, message: 'Site ID is required.' };
        }

        let site = await prisma.site.findFirst({
          where: { id: siteId, campgroundId: context.campgroundId },
        });

        if (!site) {
          site = await prisma.site.findFirst({
            where: {
              campgroundId: context.campgroundId,
              OR: [
                { name: siteId },
                { name: `Site ${siteId}` },
                { name: { contains: siteId, mode: 'insensitive' } },
              ],
            },
          });
        }

        if (!site) {
          const availableSites = await prisma.site.findMany({
            where: { campgroundId: context.campgroundId, status: 'active' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
            take: 20,
          });

          const siteNames = availableSites.map(s => s.name).join(', ');
          return {
            valid: false,
            message: `Site "${siteId}" was not found. Available sites: ${siteNames}. Please specify a valid site name.`,
          };
        }

        args.siteId = site.id;
        args._siteName = site.name;
        return { valid: true, siteName: site.name };
      },
      execute: async (args, context) => {
        const siteId = getString(args.siteId);
        const arrivalDate = getString(args.arrivalDate);
        const departureDate = getString(args.departureDate);
        const holdMinutes = getNumber(args.holdMinutes);
        const note = getString(args.note);
        const siteName = getString(args._siteName) ?? siteId;

        if (!siteId || !arrivalDate || !departureDate) {
          throw new BadRequestException('Site ID, arrival date, and departure date are required');
        }

        const hold = await this.holds.create({
          campgroundId: context.campgroundId,
          siteId,
          arrivalDate,
          departureDate,
          holdMinutes,
          note,
        });

        return {
          success: true,
          message: `Hold placed on ${siteName} from ${arrivalDate} to ${departureDate}.`,
          hold: {
            id: hold.id,
            siteId: hold.siteId,
            arrivalDate: hold.arrivalDate.toISOString().split('T')[0],
            departureDate: hold.departureDate.toISOString().split('T')[0],
            expiresAt: hold.expiresAt?.toISOString() ?? null,
            status: hold.status,
            note: hold.note,
          },
        };
      },
    });

    // List active holds
    this.tools.set('list_holds', {
      name: 'list_holds',
      description: 'List active site holds for a campground.',
      parameters: {
        type: 'object',
        properties: {},
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      execute: async (args, context) => {
        const holds = await this.holds.listByCampground(context.campgroundId);
        return {
          success: true,
          holds: holds.map((hold) => ({
            id: hold.id,
            siteId: hold.siteId,
            siteName: hold.Site?.name ?? hold.Site?.siteNumber ?? null,
            arrivalDate: hold.arrivalDate.toISOString().split('T')[0],
            departureDate: hold.departureDate.toISOString().split('T')[0],
            expiresAt: hold.expiresAt?.toISOString() ?? null,
            status: hold.status,
            note: hold.note,
          })),
          count: holds.length,
          message: `${holds.length} active hold${holds.length !== 1 ? 's' : ''}`,
        };
      },
    });

    // Release hold
    this.tools.set('release_hold', {
      name: 'release_hold',
      description: 'Release an active hold by ID.',
      parameters: {
        type: 'object',
        properties: {
          holdId: { type: 'string', description: 'Hold ID' },
        },
        required: ['holdId'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      execute: async (args, context) => {
        const holdId = getString(args.holdId);
        if (!holdId) {
          throw new BadRequestException('Hold ID is required');
        }

        const hold = await this.holds.release(context.campgroundId, holdId);
        return {
          success: true,
          message: `Released hold ${hold.id}.`,
          hold: {
            id: hold.id,
            siteId: hold.siteId,
            status: hold.status,
            expiresAt: hold.expiresAt?.toISOString() ?? null,
          },
        };
      },
    });

    // Block site
    this.tools.set('block_site', {
      name: 'block_site',
      description: 'Block a site from being booked (for maintenance, etc.).',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID' },
          reason: { type: 'string', description: 'Reason for blocking' },
          startDate: { type: 'string', description: 'Block start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'Block end date (YYYY-MM-DD)' },
        },
        required: ['siteId', 'reason'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Site Block',
      // Pre-validate before showing confirmation - check site exists and suggest alternatives
      preValidate: async (args, context, prisma) => {
        const siteId = getString(args.siteId);
        if (!siteId) {
          return { valid: false, message: 'Site ID is required.' };
        }

        // Try to find the site by ID first
        let site = await prisma.site.findFirst({
          where: { id: siteId, campgroundId: context.campgroundId },
        });

        // If not found by ID, try to find by name (e.g., "Site 21", "21", etc.)
        if (!site) {
          site = await prisma.site.findFirst({
            where: {
              campgroundId: context.campgroundId,
              OR: [
                { name: siteId },
                { name: `Site ${siteId}` },
                { name: { contains: siteId, mode: 'insensitive' } },
              ],
            },
          });
        }

        if (!site) {
          // Get available sites to suggest alternatives
          const availableSites = await prisma.site.findMany({
            where: { campgroundId: context.campgroundId, status: 'active' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
            take: 20,
          });

          const siteNames = availableSites.map(s => s.name).join(', ');
          return {
            valid: false,
            message: `Site "${siteId}" was not found. Available sites: ${siteNames}. Please specify a valid site name.`,
          };
        }

        // Update args with the actual site ID for the execute function
        args.siteId = site.id;
        args._siteName = site.name; // Store for display
        return { valid: true, siteName: site.name };
      },
      execute: async (args, context, prisma) => {
        const siteId = getString(args.siteId);
        const reason = getString(args.reason);
        const startDateInput = getString(args.startDate);
        const endDateInput = getString(args.endDate);
        if (!siteId || !reason) {
          throw new BadRequestException('Site ID and reason are required');
        }

        this.logger.log(`block_site: Starting execution for site ${siteId}, campground ${context.campgroundId}`);

        const site = await prisma.site.findFirst({
          where: { id: siteId, campgroundId: context.campgroundId },
        });

        if (!site) {
          this.logger.warn(`block_site: Site ${siteId} not found in campground ${context.campgroundId}`);
          return { success: false, message: 'Site not found' };
        }

        this.logger.log(`block_site: Found site ${site.name} (${site.id})`);

        try {
          // Create a blackout/block
          const blockId = randomUUID();
          const blockStartDate = startDateInput ? new Date(startDateInput) : new Date();
          const blockEndDate = endDateInput ? new Date(endDateInput) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

          // Check for overlapping blackouts on this site
          const existingOverlap = await prisma.blackoutDate.findFirst({
            where: {
              campgroundId: context.campgroundId,
              siteId: siteId,
              startDate: { lt: blockEndDate },
              endDate: { gt: blockStartDate },
            },
          });

          if (existingOverlap) {
            this.logger.warn(`block_site: Overlapping blackout exists for site ${site.name}`);
            return {
              success: false,
              message: `Site ${site.name} already has a block from ${existingOverlap.startDate.toISOString().split('T')[0]} to ${existingOverlap.endDate.toISOString().split('T')[0]}. Please remove the existing block first or choose different dates.`,
            };
          }

          this.logger.log(`block_site: Creating blackout with id=${blockId}, startDate=${blockStartDate.toISOString()}, endDate=${blockEndDate.toISOString()}`);

          const block = await prisma.blackoutDate.create({
            data: {
              id: blockId,
              campgroundId: context.campgroundId,
              siteId: siteId,
              startDate: blockStartDate,
              endDate: blockEndDate,
              reason: reason,
            },
          });

          this.logger.log(`block_site: Successfully created blackout ${block.id}`);

          return {
            success: true,
            message: `Site ${site.name} has been blocked: ${reason}`,
            block: {
              id: block.id,
              siteId,
              reason,
              startDate: block.startDate.toISOString().split('T')[0],
              endDate: block.endDate.toISOString().split('T')[0],
            },
          };
        } catch (error) {
          this.logger.error(`block_site: Failed to create blackout - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : '');
          return { success: false, message: `Failed to block site: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
      },
    });

    // Unblock site
    this.tools.set('unblock_site', {
      name: 'unblock_site',
      description: 'Remove a block from a site.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID' },
          blockId: { type: 'string', description: 'Block ID (optional, removes all blocks if not specified)' },
        },
        required: ['siteId'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager'],
      execute: async (args, context, prisma) => {
        const siteId = getString(args.siteId);
        const blockId = getString(args.blockId);
        if (!siteId) {
          throw new BadRequestException('Site ID is required');
        }

        const where: Prisma.BlackoutDateWhereInput = {
          campgroundId: context.campgroundId,
          siteId: siteId,
        };

        if (blockId) {
          where.id = blockId;
        }

        const deleted = await prisma.blackoutDate.deleteMany({ where });

        return {
          success: true,
          message: `Removed ${deleted.count} block${deleted.count !== 1 ? 's' : ''} from site`,
          deletedCount: deleted.count,
        };
      },
    });

    // Create maintenance ticket
    this.tools.set('create_maintenance_ticket', {
      name: 'create_maintenance_ticket',
      description: 'Create a maintenance ticket for an issue.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Issue title' },
          description: { type: 'string', description: 'Detailed description of the issue' },
          siteId: { type: 'string', description: 'Related site ID (optional)' },
          priority: { type: 'string', description: 'Priority: low, medium, high, critical' },
        },
        required: ['title', 'description'],
      },
      guestAllowed: false,
      execute: async (args, context, prisma) => {
        const title = getString(args.title);
        const description = getString(args.description);
        const siteId = getString(args.siteId);
        const priority = normalizeMaintenancePriority(args.priority);
        if (!title || !description) {
          throw new BadRequestException('Title and description are required');
        }

        const ticket = await prisma.maintenanceTicket.create({
          data: {
            id: randomUUID(),
            campgroundId: context.campgroundId,
            siteId: siteId || null,
            title,
            description,
            priority,
            status: 'open',
          },
        });

        return {
          success: true,
          message: `Maintenance ticket created: ${title}`,
          ticket: {
            id: ticket.id,
            title: ticket.title,
            priority: ticket.priority,
            status: ticket.status,
          },
        };
      },
    });

    // Lookup guest
    this.tools.set('lookup_guest', {
      name: 'lookup_guest',
      description: 'Search for a guest by name, email, or phone.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term (name, email, or phone)' },
        },
        required: ['query'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      execute: async (args, context, prisma) => {
        const query = getString(args.query);
        if (!query) {
          throw new BadRequestException('Query is required');
        }

        const guests = await prisma.guest.findMany({
          where: {
            Reservation: { some: { campgroundId: context.campgroundId } },
            OR: [
              { primaryFirstName: { contains: query, mode: 'insensitive' } },
              { primaryLastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
            ],
          },
          include: {
            Reservation: {
              orderBy: { arrivalDate: 'desc' },
              take: 3,
              select: {
                id: true,
                arrivalDate: true,
                departureDate: true,
                status: true,
              },
            },
          },
          take: 10,
        });

        return {
          success: true,
          guests: guests.map(g => ({
            id: g.id,
            name: `${g.primaryFirstName} ${g.primaryLastName}`,
            email: g.email,
            phone: g.phone,
            recentReservations: g.Reservation.map(r => ({
              id: r.id,
              code: r.id,
              dates: `${r.arrivalDate.toISOString().split('T')[0]} - ${r.departureDate.toISOString().split('T')[0]}`,
              status: r.status,
            })),
          })),
          count: guests.length,
          message: `Found ${guests.length} guest${guests.length !== 1 ? 's' : ''}`,
        };
      },
    });

    // Send message to guest
    this.tools.set('send_guest_message', {
      name: 'send_guest_message',
      description: 'Send a message to a guest.',
      parameters: {
        type: 'object',
        properties: {
          guestId: { type: 'string', description: 'Guest ID' },
          reservationId: { type: 'string', description: 'Reservation ID (optional)' },
          message: { type: 'string', description: 'Message content' },
        },
        required: ['guestId', 'message'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      execute: async (args, context, prisma) => {
        const guestId = getString(args.guestId);
        const reservationId = getString(args.reservationId);
        const message = getString(args.message);
        if (!guestId || !message) {
          throw new BadRequestException('Guest ID and message are required');
        }

        const guest = await prisma.guest.findFirst({
          where: {
            id: guestId,
            Reservation: { some: { campgroundId: context.campgroundId } }
          },
        });

        if (!guest) {
          return { success: false, message: 'Guest not found' };
        }

        const reservation = reservationId
          ? await prisma.reservation.findFirst({
            where: { id: reservationId, campgroundId: context.campgroundId, guestId: guest.id },
          })
          : await prisma.reservation.findFirst({
            where: { campgroundId: context.campgroundId, guestId: guest.id },
            orderBy: { arrivalDate: 'desc' },
          });

        if (!reservation) {
          return { success: false, message: 'Reservation not found for guest' };
        }

        const created = await prisma.message.create({
          data: {
            id: randomUUID(),
            campgroundId: context.campgroundId,
            guestId: guest.id,
            reservationId: reservation.id,
            senderType: 'staff',
            content: message,
          },
        });

        return {
          success: true,
          message: `Message sent to ${guest.primaryFirstName} ${guest.primaryLastName}`,
          messageId: created.id,
        };
      },
    });

    // Apply discount
    this.tools.set('apply_discount', {
      name: 'apply_discount',
      description: 'Apply a discount to a reservation.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID' },
          discountCents: { type: 'number', description: 'Discount amount in cents' },
          discountPercent: { type: 'number', description: 'Discount percentage (alternative to cents)' },
          reason: { type: 'string', description: 'Reason for discount' },
        },
        required: ['reservationId', 'reason'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Discount',
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        const discountCents = getNumber(args.discountCents);
        const discountPercent = getNumber(args.discountPercent);
        const reason = getString(args.reason);
        if (!reservationId || !reason) {
          throw new BadRequestException('Reservation ID and reason are required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: { id: reservationId, campgroundId: context.campgroundId },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        let discount = discountCents ?? 0;
        if (discountPercent && !discountCents) {
          discount = Math.round(reservation.baseSubtotal * (discountPercent / 100));
        }

        const newTotal = reservation.totalAmount - discount;
        const newBalance = Math.max(0, reservation.balanceAmount - discount);

        // Use transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              totalAmount: newTotal,
              balanceAmount: newBalance,
              discountsAmount: reservation.discountsAmount + discount,
            },
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              id: randomUUID(),
              campgroundId: context.campgroundId,
              reservationId: reservationId,
              amountCents: -discount,
              description: `Discount: ${reason}`,
              occurredAt: new Date(),
              sourceType: 'discount',
            },
          });
        });

        return {
          success: true,
          message: `Applied $${(discount / 100).toFixed(2)} discount. New balance: $${(newBalance / 100).toFixed(2)}`,
          discount: {
            amount: `$${(discount / 100).toFixed(2)}`,
            reason,
            newTotal: `$${(newTotal / 100).toFixed(2)}`,
            newBalance: `$${(newBalance / 100).toFixed(2)}`,
          },
        };
      },
    });

    // Add charge
    this.tools.set('add_charge', {
      name: 'add_charge',
      description: 'Add an additional charge to a reservation.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID' },
          amountCents: { type: 'number', description: 'Charge amount in cents' },
          description: { type: 'string', description: 'Charge description' },
        },
        required: ['reservationId', 'amountCents', 'description'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Charge',
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        const amountCents = getNumber(args.amountCents);
        const description = getString(args.description);
        if (!reservationId || amountCents === undefined || !description) {
          throw new BadRequestException('Reservation ID, amount, and description are required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: { id: reservationId, campgroundId: context.campgroundId },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        const newTotal = reservation.totalAmount + amountCents;
        const newBalance = reservation.balanceAmount + amountCents;

        // Use transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              totalAmount: newTotal,
              balanceAmount: newBalance,
            },
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              id: randomUUID(),
              campgroundId: context.campgroundId,
              reservationId: reservationId,
              amountCents: amountCents,
              description: description,
              occurredAt: new Date(),
              sourceType: 'charge',
            },
          });
        });

        return {
          success: true,
          message: `Added $${(amountCents / 100).toFixed(2)} charge. New balance: $${(newBalance / 100).toFixed(2)}`,
          charge: {
            amount: `$${(amountCents / 100).toFixed(2)}`,
            description,
            newTotal: `$${(newTotal / 100).toFixed(2)}`,
            newBalance: `$${(newBalance / 100).toFixed(2)}`,
          },
        };
      },
    });

    // Move reservation to different site
    this.tools.set('move_reservation', {
      name: 'move_reservation',
      description: 'Move a reservation to a different site.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID' },
          newSiteId: { type: 'string', description: 'New site ID' },
          reason: { type: 'string', description: 'Reason for move' },
        },
        required: ['reservationId', 'newSiteId'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Site Move',
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        const newSiteId = getString(args.newSiteId);
        const reason = getString(args.reason);
        if (!reservationId || !newSiteId) {
          throw new BadRequestException('Reservation ID and new site ID are required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: { id: reservationId, campgroundId: context.campgroundId },
          include: { Site: true, Guest: true },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        const newSite = await prisma.site.findFirst({
          where: { id: newSiteId, campgroundId: context.campgroundId },
        });

        if (!newSite) {
          return { success: false, message: 'New site not found' };
        }

        // Check availability of new site
        const conflict = await prisma.reservation.findFirst({
          where: {
            siteId: newSiteId,
            status: { in: ['pending', 'confirmed', 'checked_in'] },
            id: { not: reservationId },
            arrivalDate: { lt: reservation.departureDate },
            departureDate: { gt: reservation.arrivalDate },
          },
        });

        if (conflict) {
          return { success: false, message: 'New site is not available for these dates' };
        }

        const oldSiteName = reservation.Site?.name;

        await prisma.reservation.update({
          where: { id: reservationId },
          data: { siteId: newSiteId },
        });

        return {
          success: true,
          message: `Moved reservation from ${oldSiteName} to ${newSite.name}`,
          move: {
            from: oldSiteName,
            to: newSite.name,
            reason: reason || 'Not specified',
          },
        };
      },
    });

    // Extend stay
    this.tools.set('extend_stay', {
      name: 'extend_stay',
      description: 'Extend a reservation by adding additional nights.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string', description: 'Reservation ID' },
          additionalNights: { type: 'number', description: 'Number of nights to add' },
          newDepartureDate: { type: 'string', description: 'New departure date (YYYY-MM-DD) - alternative to additionalNights' },
        },
        required: ['reservationId'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'front_desk'],
      requiresConfirmation: true,
      confirmationTitle: 'Confirm Stay Extension',
      execute: async (args, context, prisma) => {
        const reservationId = getString(args.reservationId);
        const additionalNights = getNumber(args.additionalNights);
        const newDepartureDate = getString(args.newDepartureDate);
        if (!reservationId) {
          throw new BadRequestException('Reservation ID is required');
        }

        const reservation = await prisma.reservation.findFirst({
          where: { id: reservationId, campgroundId: context.campgroundId },
          include: { Site: { include: { SiteClass: true } } },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        let newDeparture: Date;
        if (newDepartureDate) {
          newDeparture = new Date(newDepartureDate);
        } else if (additionalNights) {
          newDeparture = new Date(reservation.departureDate);
          newDeparture.setDate(newDeparture.getDate() + additionalNights);
        } else {
          return { success: false, message: 'Specify either additionalNights or newDepartureDate' };
        }

        // Check for conflicts
        const conflict = await prisma.reservation.findFirst({
          where: {
            siteId: reservation.siteId,
            status: { in: ['pending', 'confirmed', 'checked_in'] },
            id: { not: reservationId },
            arrivalDate: { lt: newDeparture },
            departureDate: { gt: reservation.departureDate },
          },
        });

        if (conflict) {
          return { success: false, message: 'Cannot extend - site is booked for those dates' };
        }

        // Calculate additional cost
        const extraNights = Math.ceil((newDeparture.getTime() - reservation.departureDate.getTime()) / (1000 * 60 * 60 * 24));
        const nightlyRate = reservation.Site?.SiteClass?.defaultRate ?? 0;
        const additionalCost = nightlyRate * extraNights;

        await prisma.reservation.update({
          where: { id: reservationId },
          data: {
            departureDate: newDeparture,
            totalAmount: reservation.totalAmount + additionalCost,
            balanceAmount: reservation.balanceAmount + additionalCost,
          },
        });

        return {
          success: true,
          message: `Extended stay by ${extraNights} night${extraNights !== 1 ? 's' : ''}. Additional charge: $${(additionalCost / 100).toFixed(2)}`,
          extension: {
            originalDeparture: reservation.departureDate.toISOString().split('T')[0],
            newDeparture: newDeparture.toISOString().split('T')[0],
            additionalNights: extraNights,
            additionalCost: `$${(additionalCost / 100).toFixed(2)}`,
          },
        };
      },
    });
  }

  /**
   * Get tools available for a specific user context
   */
  getToolsForUser(context: ChatContext): ToolDefinition[] {
    const isGuest = context.participantType === ChatParticipantType.guest;

    return Array.from(this.tools.values()).filter(tool => {
      // Check guest permission
      if (isGuest && !tool.guestAllowed) {
        return false;
      }

      // Check staff role permission
      if (!isGuest && tool.staffRoles && tool.staffRoles.length > 0) {
        if (!context.role || !tool.staffRoles.includes(context.role)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get a specific tool
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool
   */
  private redactLogValue(value: unknown, depth = 0): unknown {
    if (depth > 4) return '[truncated]';
    if (typeof value === 'string') {
      const { anonymizedText } = this.privacy.anonymize(value, 'minimal');
      return anonymizedText.length > 180 ? `${anonymizedText.slice(0, 180)}...` : anonymizedText;
    }
    if (!isRecord(value)) {
      if (Array.isArray(value)) {
        return value.slice(0, 10).map((entry) => this.redactLogValue(entry, depth + 1));
      }
      return value;
    }
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = this.redactLogValue(entry, depth + 1);
    }
    return result;
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ChatContext,
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }

    // Verify permissions
    const isGuest = context.participantType === ChatParticipantType.guest;
    if (isGuest && !tool.guestAllowed) {
      throw new ForbiddenException('This action is not available');
    }

    if (!isGuest && tool.staffRoles && tool.staffRoles.length > 0) {
      if (!context.role || !tool.staffRoles.includes(context.role)) {
        throw new ForbiddenException('You do not have permission for this action');
      }
    }

    // Validate arguments with Zod if schema exists
    const schema = toolArgSchemas[name];
    if (schema) {
      const result = schema.safeParse(args);
      if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        this.logger.warn(`Tool argument validation failed for ${name}: ${errors}`);
        throw new BadRequestException(`Invalid arguments: ${errors}`);
      }
    }

    const redactedArgs = this.redactLogValue(args);
    this.logger.log(`Executing tool: ${name} with args: ${JSON.stringify(redactedArgs)}`);

    const result = await tool.execute(args, context, this.prisma);
    await this.recordToolAudit(name, args, context, result);
    return result;
  }

  private async recordToolAudit(
    name: string,
    args: Record<string, unknown>,
    context: ChatContext,
    result: unknown,
  ) {
    const config = AUDITED_TOOL_ACTIONS[name];
    if (!config) return;

    if (isRecord(result) && result.success === false) return;

    const entityId = config.resolveEntityId(args, result);
    if (!entityId) return;

    const actorId = context.participantType === ChatParticipantType.guest
      ? null
      : context.participantId;
    const afterPayload = sanitizeAuditValue({ tool: name, args, result });

    try {
      await this.audit.record({
        campgroundId: context.campgroundId,
        actorId,
        action: config.action,
        entity: config.entity,
        entityId,
        before: null,
        after: isRecord(afterPayload) ? afterPayload : { tool: name },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record audit for tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Run preValidate for a tool if it exists
   * Returns null if no preValidate or if validation passes
   * Returns error message if validation fails
   */
  async runPreValidate(
    name: string,
    args: Record<string, unknown>,
    context: ChatContext,
  ): Promise<PreValidateResult | null> {
    const tool = this.tools.get(name);
    if (!tool || !tool.preValidate) {
      return null; // No preValidate, continue normally
    }

    try {
      const result = await tool.preValidate(args, context, this.prisma);
      return result;
    } catch (error) {
      this.logger.error(`PreValidate error for ${name}:`, error);
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Format confirmation description for display
   */
  formatConfirmationSummary(toolName: string, args: Record<string, unknown>): string | undefined {
    const reservationId = getString(args.reservationId);
    const reason = getString(args.reason);

    switch (toolName) {
      case 'check_in_guest':
        return reservationId ? `Check in reservation ${reservationId}.` : 'Check in the guest.';
      case 'check_out_guest':
        return reservationId ? `Check out reservation ${reservationId}.` : 'Check out the guest.';
      case 'process_refund': {
        const amount = formatCurrency(getNumber(args.amountCents));
        return reservationId && amount
          ? `Refund ${amount} for reservation ${reservationId}.`
          : amount
            ? `Refund ${amount}.`
            : 'Process a refund.';
      }
      case 'cancel_reservation':
        return reservationId ? `Cancel reservation ${reservationId}.` : 'Cancel the reservation.';
      case 'block_site': {
        const siteName = getString(args._siteName) ?? getString(args.siteName) ?? getString(args.siteId);
        const startDate = getString(args.startDate);
        const endDate = getString(args.endDate);
        const window = startDate && endDate ? ` from ${startDate} to ${endDate}` : startDate ? ` starting ${startDate}` : '';
        return siteName
          ? `Block ${siteName}${window}${reason ? ` for "${reason}"` : ''}.`
          : `Block a site${window}${reason ? ` for "${reason}"` : ''}.`;
      }
      case 'create_hold': {
        const siteName = getString(args._siteName) ?? getString(args.siteName) ?? getString(args.siteId);
        const arrivalDate = getString(args.arrivalDate);
        const departureDate = getString(args.departureDate);
        if (siteName && arrivalDate && departureDate) {
          return `Hold ${siteName} from ${arrivalDate} to ${departureDate}.`;
        }
        return 'Place a temporary hold on the site.';
      }
      case 'apply_discount': {
        const discountCents = getNumber(args.discountCents);
        const discountPercent = getNumber(args.discountPercent);
        const amount = discountCents !== undefined
          ? formatCurrency(discountCents)
          : discountPercent !== undefined
            ? `${discountPercent}%`
            : undefined;
        const amountLabel = amount ?? 'a discount';
        return reservationId
          ? `Apply ${amountLabel} to reservation ${reservationId}${reason ? ` for "${reason}"` : ''}.`
          : `Apply ${amountLabel}${reason ? ` for "${reason}"` : ''}.`;
      }
      case 'add_charge': {
        const amount = formatCurrency(getNumber(args.amountCents));
        const description = getString(args.description);
        const amountLabel = amount ?? 'an additional charge';
        return reservationId
          ? `Add ${amountLabel} to reservation ${reservationId}${description ? ` for "${description}"` : ''}.`
          : `Add ${amountLabel}${description ? ` for "${description}"` : ''}.`;
      }
      case 'move_reservation': {
        const newSiteId = getString(args.newSiteId);
        return reservationId && newSiteId
          ? `Move reservation ${reservationId} to site ${newSiteId}${reason ? ` for "${reason}"` : ''}.`
          : reservationId
            ? `Move reservation ${reservationId}${reason ? ` for "${reason}"` : ''}.`
            : 'Move the reservation to a different site.';
      }
      case 'extend_stay': {
        const additionalNights = getNumber(args.additionalNights);
        const newDepartureDate = getString(args.newDepartureDate);
        const extension = newDepartureDate
          ? `to ${newDepartureDate}`
          : additionalNights
            ? `by ${additionalNights} night${additionalNights !== 1 ? 's' : ''}`
            : 'by additional nights';
        return reservationId
          ? `Extend reservation ${reservationId} ${extension}.`
          : `Extend the stay ${extension}.`;
      }
      default:
        return undefined;
    }
  }

  formatConfirmationDescription(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
      case 'check_in_guest':
        return `Check in reservation ${args.reservationId}?`;
      case 'check_out_guest':
        return `Check out reservation ${args.reservationId}?`;
      case 'process_refund':
        return `Process refund of $${((getNumber(args.amountCents) ?? 0) / 100).toFixed(2)}?`;
      case 'cancel_reservation':
        return `Cancel reservation ${args.reservationId}? This action cannot be undone.`;
      case 'block_site': {
        const siteName = args._siteName || args.siteName || args.siteId;
        const dateInfo = args.startDate && args.endDate
          ? ` from ${args.startDate} to ${args.endDate}`
          : args.startDate
          ? ` starting ${args.startDate}`
          : '';
        return `Block ${siteName}${dateInfo} for "${args.reason}"?`;
      }
      case 'create_hold': {
        const siteName = getString(args._siteName) ?? getString(args.siteName) ?? getString(args.siteId);
        const arrivalDate = getString(args.arrivalDate);
        const departureDate = getString(args.departureDate);
        if (siteName && arrivalDate && departureDate) {
          return `Place a hold on ${siteName} from ${arrivalDate} to ${departureDate}?`;
        }
        return 'Place a temporary site hold?';
      }
      default:
        return `Execute ${toolName}?`;
    }
  }
}
