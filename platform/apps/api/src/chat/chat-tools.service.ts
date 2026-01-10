import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatParticipantType } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Date string validation (YYYY-MM-DD format)
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD');

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

// Tool argument schemas
const toolArgSchemas: Record<string, z.ZodSchema> = {
  check_availability: z.object({
    arrivalDate: dateStringSchema,
    departureDate: dateStringSchema,
    guests: z.number().int().positive().optional(),
    siteType: z.enum(['rv', 'tent', 'cabin']).optional(),
  }),
  get_quote: z.object({
    siteId: z.string().min(1, 'Site ID is required'),
    arrivalDate: dateStringSchema,
    departureDate: dateStringSchema,
    guests: z.number().int().positive().optional(),
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
  }),
  get_revenue_report: z.object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  }),
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
  [key: string]: any; // Additional data to pass to execute
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  guestAllowed: boolean;
  staffRoles?: string[]; // If not specified, all staff can use
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  // Pre-validate before showing confirmation dialog - can fail early with helpful message
  preValidate?: (args: Record<string, any>, context: ChatContext, prisma: PrismaService) => Promise<PreValidateResult>;
  execute: (args: Record<string, any>, context: ChatContext, prisma: PrismaService) => Promise<any>;
}

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name);
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(private readonly prisma: PrismaService) {
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
        },
        required: ['arrivalDate', 'departureDate'],
      },
      guestAllowed: true,
      execute: async (args, context, prisma) => {
        const { arrivalDate, departureDate, guests, siteType } = args;

        // Get all sites for this campground
        const sites = await prisma.site.findMany({
          where: {
            campgroundId: context.campgroundId,
            status: 'active',
            ...(siteType && { siteClass: { type: siteType as any } }),
          },
          include: {
            siteClass: true,
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

        // Calculate nights
        const arrival = new Date(arrivalDate);
        const departure = new Date(departureDate);
        const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));

        return {
          success: true,
          availableSites: availableSites.slice(0, 10).map(s => ({
            id: s.id,
            name: s.name,
            type: s.siteClass?.type,
            className: s.siteClass?.name,
            maxGuests: s.maxOccupancy,
            pricePerNight: s.siteClass?.baseRateCents ? `$${(s.siteClass.baseRateCents / 100).toFixed(2)}` : 'Contact for pricing',
            totalEstimate: s.siteClass?.baseRateCents ? `$${((s.siteClass.baseRateCents * nights) / 100).toFixed(2)}` : null,
            amenities: s.amenities || [],
          })),
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
        },
        required: ['siteId', 'arrivalDate', 'departureDate'],
      },
      guestAllowed: true,
      // Pre-validate site exists and resolve name to ID
      preValidate: async (args, context, prisma) => {
        const { siteId } = args;

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
        args._resolvedSite = site; // Pass the full site object to avoid re-querying
        return { valid: true, siteName: site.name };
      },
      execute: async (args, context, prisma) => {
        const { siteId, arrivalDate, departureDate, guests = 2, _resolvedSite } = args;

        // Use pre-resolved site if available, otherwise query
        const site = _resolvedSite || await prisma.site.findFirst({
          where: { id: siteId, campgroundId: context.campgroundId },
          include: { SiteClass: true },
        });

        if (!site) {
          return { success: false, message: 'Site not found' };
        }

        const arrival = new Date(arrivalDate);
        const departure = new Date(departureDate);
        const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));

        const baseRateCents = site.siteClass?.baseRateCents || 0;
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
        const siteLockFeeCents = site.siteClass?.siteLockFeeCents || 0;

        // Build response - only mention site lock fee if campground actually charges one
        const isGuest = context.participantType === ChatParticipantType.guest;
        let siteNote = '';
        let canGuaranteeSite = true;

        if (isGuest && site.siteClass && siteLockFeeCents > 0) {
          // Campground charges a site lock fee - let guest know
          siteNote = `\n\nNote: Bookings guarantee the site class (${site.siteClass.name}) but not a specific site. To guarantee ${site.name}, add the site lock fee of $${(siteLockFeeCents / 100).toFixed(2)}.`;
          canGuaranteeSite = false;
        }
        // If no site lock fee, guest can book the specific site directly - no note needed

        return {
          success: true,
          quote: {
            site: site.name,
            siteClass: site.siteClass?.name,
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
              ? `Bookings guarantee the ${site.siteClass?.name} class, not a specific site. Add $${(siteLockFeeCents / 100).toFixed(2)} site lock fee to guarantee ${site.name}.`
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
        const { query, startDate, endDate, status } = args;

        const where: any = { campgroundId: context.campgroundId };

        if (query) {
          where.OR = [
            { confirmationCode: { contains: query, mode: 'insensitive' } },
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
            confirmationCode: r.confirmationCode,
            guestName: r.Guest ? `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}` : 'Unknown',
            guestEmail: r.Guest?.email,
            site: r.Site?.name,
            arrival: r.arrivalDate.toISOString().split('T')[0],
            departure: r.departureDate.toISOString().split('T')[0],
            status: r.status,
            balance: `$${(r.balanceDueCents / 100).toFixed(2)}`,
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
        const { reservationId } = args;

        const where: any = {
          campgroundId: context.campgroundId,
          OR: [
            { id: reservationId },
            { confirmationCode: reservationId },
          ],
        };

        // Guests can only see their own reservations
        if (context.participantType === ChatParticipantType.guest) {
          where.guestId = context.participantId;
        }

        const reservation = await prisma.reservation.findFirst({
          where,
          include: {
            Guest: { select: { primaryFirstName: true, primaryLastName: true, email: true, phone: true } },
            Site: { select: { name: true, siteClass: { select: { name: true } } } },
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
            confirmationCode: reservation.confirmationCode,
            status: reservation.status,
            guest: reservation.Guest ? {
              name: `${reservation.Guest.primaryFirstName} ${reservation.Guest.primaryLastName}`,
              email: reservation.Guest.email,
              phone: reservation.Guest.phone,
            } : null,
            site: reservation.Site?.name,
            siteClass: reservation.Site?.siteClass?.name,
            arrival: reservation.arrivalDate.toISOString().split('T')[0],
            departure: reservation.departureDate.toISOString().split('T')[0],
            nights: Math.ceil((reservation.departureDate.getTime() - reservation.arrivalDate.getTime()) / (1000 * 60 * 60 * 24)),
            guests: reservation.numGuests,
            totals: {
              subtotal: `$${(reservation.subtotalCents / 100).toFixed(2)}`,
              tax: `$${(reservation.taxCents / 100).toFixed(2)}`,
              fees: `$${(reservation.feesCents / 100).toFixed(2)}`,
              total: `$${(reservation.totalCents / 100).toFixed(2)}`,
              paid: `$${((reservation.totalCents - reservation.balanceDueCents) / 100).toFixed(2)}`,
              balance: `$${(reservation.balanceDueCents / 100).toFixed(2)}`,
            },
            recentPayments: reservation.Payment.map(p => ({
              amount: `$${(p.amountCents / 100).toFixed(2)}`,
              method: p.method,
              status: p.status,
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

        const { includeHistory = false } = args;

        const where: any = {
          campgroundId: context.campgroundId,
          guestId: context.participantId,
        };

        if (!includeHistory) {
          where.status = { in: ['pending', 'confirmed', 'checked_in'] };
        }

        const reservations = await prisma.reservation.findMany({
          where,
          include: {
            site: { select: { name: true } },
          },
          orderBy: { arrivalDate: 'desc' },
          take: 10,
        });

        return {
          success: true,
          reservations: reservations.map(r => ({
            id: r.id,
            confirmationCode: r.confirmationCode,
            site: r.site?.name,
            arrival: r.arrivalDate.toISOString().split('T')[0],
            departure: r.departureDate.toISOString().split('T')[0],
            status: r.status,
            balance: `$${(r.balanceDueCents / 100).toFixed(2)}`,
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
            confirmationCode: r.confirmationCode,
            guestName: r.Guest ? `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}` : 'Unknown',
            phone: r.Guest?.phone,
            site: r.Site?.name,
            balance: `$${(r.balanceDueCents / 100).toFixed(2)}`,
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
            confirmationCode: r.confirmationCode,
            guestName: r.Guest ? `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}` : 'Unknown',
            site: r.Site?.name,
            balance: `$${(r.balanceDueCents / 100).toFixed(2)}`,
          })),
          count: departures.length,
          message: `${departures.length} departure${departures.length !== 1 ? 's' : ''} today`,
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
        const { reservationId } = args;

        const reservation = await prisma.reservation.findFirst({
          where: {
            campgroundId: context.campgroundId,
            OR: [{ id: reservationId }, { confirmationCode: reservationId }],
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
          data: { status: 'checked_in', checkedInAt: new Date() },
        });

        return {
          success: true,
          message: `Checked in ${reservation.Guest?.primaryFirstName} ${reservation.Guest?.primaryLastName} to ${reservation.Site?.name}`,
          reservation: {
            id: updated.id,
            confirmationCode: updated.confirmationCode,
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
        const { reservationId } = args;

        const reservation = await prisma.reservation.findFirst({
          where: {
            campgroundId: context.campgroundId,
            OR: [{ id: reservationId }, { confirmationCode: reservationId }],
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
        if (reservation.balanceDueCents > 0) {
          return {
            success: false,
            message: `Outstanding balance of $${(reservation.balanceDueCents / 100).toFixed(2)}. Collect payment before checkout.`,
            balance: reservation.balanceDueCents,
          };
        }

        const updated = await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: 'checked_out', checkedOutAt: new Date() },
        });

        return {
          success: true,
          message: `Checked out ${reservation.Guest?.primaryFirstName} ${reservation.Guest?.primaryLastName} from ${reservation.Site?.name}`,
          reservation: {
            id: updated.id,
            confirmationCode: updated.confirmationCode,
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
        const { reservationId } = args;

        const where: any = {
          campgroundId: context.campgroundId,
          OR: [{ id: reservationId }, { confirmationCode: reservationId }],
        };

        if (context.participantType === ChatParticipantType.guest) {
          where.guestId = context.participantId;
        }

        const reservation = await prisma.reservation.findFirst({
          where,
          select: {
            confirmationCode: true,
            totalCents: true,
            balanceDueCents: true,
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        const paid = reservation.totalCents - reservation.balanceDueCents;

        return {
          success: true,
          balance: {
            total: `$${(reservation.totalCents / 100).toFixed(2)}`,
            paid: `$${(paid / 100).toFixed(2)}`,
            due: `$${(reservation.balanceDueCents / 100).toFixed(2)}`,
          },
          message: reservation.balanceDueCents > 0
            ? `Balance due: $${(reservation.balanceDueCents / 100).toFixed(2)}`
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
        },
        required: [],
      },
      guestAllowed: true,
      execute: async (args, context, prisma) => {
        let startDate: Date;
        let endDate: Date;

        if (args.reservationId) {
          const reservation = await prisma.reservation.findFirst({
            where: {
              campgroundId: context.campgroundId,
              OR: [{ id: args.reservationId }, { confirmationCode: args.reservationId }],
            },
          });
          if (!reservation) {
            return { success: false, message: 'Reservation not found' };
          }
          startDate = reservation.arrivalDate;
          endDate = reservation.departureDate;
        } else {
          startDate = args.startDate ? new Date(args.startDate) : new Date();
          endDate = args.endDate ? new Date(args.endDate) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        const events = await prisma.event.findMany({
          where: {
            campgroundId: context.campgroundId,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
            status: 'published',
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
            category: e.category,
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
        const { reservationId, requestedTime, notes } = args;

        const where: any = {
          campgroundId: context.campgroundId,
          OR: [{ id: reservationId }, { confirmationCode: reservationId }],
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
        const { reservationId, requestedTime, notes } = args;

        const where: any = {
          campgroundId: context.campgroundId,
          OR: [{ id: reservationId }, { confirmationCode: reservationId }],
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
        const { message, reservationId, urgent } = args;

        let reservation = null;
        if (reservationId) {
          reservation = await prisma.reservation.findFirst({
            where: {
              campgroundId: context.campgroundId,
              OR: [{ id: reservationId }, { confirmationCode: reservationId }],
              ...(context.participantType === ChatParticipantType.guest && { guestId: context.participantId }),
            },
          });
        }

        const created = await prisma.message.create({
          data: {
            campgroundId: context.campgroundId,
            reservationId: reservation?.id,
            guestId: context.participantType === ChatParticipantType.guest ? context.participantId : null,
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
        },
        required: ['startDate', 'endDate'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager'],
      execute: async (args, context, prisma) => {
        const { startDate, endDate } = args;
        const start = new Date(startDate);
        const end = new Date(endDate);

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

        return {
          success: true,
          occupancy: {
            totalSites,
            dateRange: { start: startDate, end: endDate },
            averageOccupancy: `${avgOccupancy}%`,
            dailyBreakdown: days.slice(0, 14), // Limit to 14 days
          },
          message: `Average occupancy: ${avgOccupancy}% (${totalSites} total sites)`,
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
        },
        required: ['startDate', 'endDate'],
      },
      guestAllowed: false,
      staffRoles: ['owner', 'manager', 'finance'],
      execute: async (args, context, prisma) => {
        const { startDate, endDate } = args;

        const payments = await prisma.payment.findMany({
          where: {
            campgroundId: context.campgroundId,
            status: 'completed',
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
          },
        });

        const totalRevenue = payments.reduce((sum, p) => sum + p.amountCents, 0);
        const paymentsByMethod = payments.reduce((acc, p) => {
          const method = p.method || 'other';
          acc[method] = (acc[method] || 0) + p.amountCents;
          return acc;
        }, {} as Record<string, number>);

        return {
          success: true,
          revenue: {
            total: `$${(totalRevenue / 100).toFixed(2)}`,
            transactionCount: payments.length,
            byMethod: Object.fromEntries(
              Object.entries(paymentsByMethod).map(([k, v]) => [k, `$${(v / 100).toFixed(2)}`])
            ),
            dateRange: { start: startDate, end: endDate },
          },
          message: `Total revenue: $${(totalRevenue / 100).toFixed(2)} from ${payments.length} transactions`,
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
        const { siteId } = args;

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
        const { siteId, reason, startDate, endDate, _siteName } = args;

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
          const blockStartDate = startDate ? new Date(startDate) : new Date();
          const blockEndDate = endDate ? new Date(endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

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
        const { siteId, blockId } = args;

        const where: any = {
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
        const { title, description, siteId, priority = 'medium' } = args;

        const ticket = await prisma.maintenanceTicket.create({
          data: {
            campgroundId: context.campgroundId,
            siteId: siteId || null,
            title,
            description,
            priority: priority as any,
            status: 'open',
            reportedBy: context.participantId,
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
        const { query } = args;

        const guests = await prisma.guest.findMany({
          where: {
            campgroundId: context.campgroundId,
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
                confirmationCode: true,
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
              code: r.confirmationCode,
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
        const { guestId, reservationId, message } = args;

        const guest = await prisma.guest.findFirst({
          where: { id: guestId, campgroundId: context.campgroundId },
        });

        if (!guest) {
          return { success: false, message: 'Guest not found' };
        }

        const created = await prisma.message.create({
          data: {
            campgroundId: context.campgroundId,
            guestId: guestId,
            reservationId: reservationId || null,
            senderType: 'staff',
            senderId: context.participantId,
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
        const { reservationId, discountCents, discountPercent, reason } = args;

        const reservation = await prisma.reservation.findFirst({
          where: { id: reservationId, campgroundId: context.campgroundId },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        let discount = discountCents || 0;
        if (discountPercent && !discountCents) {
          discount = Math.round(reservation.subtotalCents * (discountPercent / 100));
        }

        const newTotal = reservation.totalCents - discount;
        const newBalance = Math.max(0, reservation.balanceDueCents - discount);

        // Use transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              totalCents: newTotal,
              balanceDueCents: newBalance,
              discountCents: (reservation.discountCents || 0) + discount,
            },
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              campgroundId: context.campgroundId,
              reservationId: reservationId,
              type: 'discount',
              amountCents: -discount,
              description: `Discount: ${reason}`,
              createdBy: context.participantId,
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
        const { reservationId, amountCents, description } = args;

        const reservation = await prisma.reservation.findFirst({
          where: { id: reservationId, campgroundId: context.campgroundId },
        });

        if (!reservation) {
          return { success: false, message: 'Reservation not found' };
        }

        const newTotal = reservation.totalCents + amountCents;
        const newBalance = reservation.balanceDueCents + amountCents;

        // Use transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              totalCents: newTotal,
              balanceDueCents: newBalance,
            },
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              campgroundId: context.campgroundId,
              reservationId: reservationId,
              type: 'charge',
              amountCents: amountCents,
              description: description,
              createdBy: context.participantId,
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
        const { reservationId, newSiteId, reason } = args;

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
        const { reservationId, additionalNights, newDepartureDate } = args;

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
        const nightlyRate = reservation.Site?.siteClass?.baseRateCents || 0;
        const additionalCost = nightlyRate * extraNights;

        await prisma.reservation.update({
          where: { id: reservationId },
          data: {
            departureDate: newDeparture,
            totalCents: reservation.totalCents + additionalCost,
            balanceDueCents: reservation.balanceDueCents + additionalCost,
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
  async executeTool(
    name: string,
    args: Record<string, any>,
    context: ChatContext,
  ): Promise<any> {
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

    this.logger.log(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);

    return tool.execute(args, context, this.prisma);
  }

  /**
   * Run preValidate for a tool if it exists
   * Returns null if no preValidate or if validation passes
   * Returns error message if validation fails
   */
  async runPreValidate(
    name: string,
    args: Record<string, any>,
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
  formatConfirmationDescription(toolName: string, args: Record<string, any>): string {
    switch (toolName) {
      case 'check_in_guest':
        return `Check in reservation ${args.reservationId}?`;
      case 'check_out_guest':
        return `Check out reservation ${args.reservationId}?`;
      case 'process_refund':
        return `Process refund of $${((args.amountCents || 0) / 100).toFixed(2)}?`;
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
      default:
        return `Execute ${toolName}?`;
    }
  }
}
