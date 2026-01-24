import { BadRequestException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { CreateOtaChannelDto } from "./dto/create-ota-channel.dto";
import { UpdateOtaChannelDto } from "./dto/update-ota-channel.dto";
import { UpsertOtaMappingDto } from "./dto/upsert-mapping.dto";
import { SaveOtaConfigDto } from "./dto/save-ota-config.dto";
import { createHmac } from "crypto";
import { randomUUID } from "crypto";

type OtaConfig = {
  campgroundId: string;
  provider: string;
  externalAccountId?: string | null;
  propertyId?: string | null;
  apiKey?: string | null;
  channelId?: string | null;
  notes?: string | null;
  lastSyncStatus: "not_started" | "ok" | "error" | "partial";
  lastSyncAt?: string | null;
  lastSyncMessage?: string | null;
  lastUpdatedAt?: string | null;
  pendingSyncs?: number;
};

type OtaStats = {
  provider: string;
  campgroundId: string;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  success: number;
  failure: number;
  lastWebhookSuccessAt?: number;
  lastWebhookFailureAt?: number;
  webhookSuccess: number;
  webhookFailure: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getStringId = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const getNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const getDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Unknown error";

@Injectable()
export class OtaService {
  private readonly logger = new Logger(OtaService.name);
  private readonly configStore = new Map<string, OtaConfig>();
  private readonly stats = new Map<string, OtaStats>();
  private readonly freshnessMinutes = Number(process.env.OTA_SYNC_MAX_AGE_MINUTES ?? 15);
  private readonly webhookErrorRateTarget = Number(process.env.OTA_WEBHOOK_ERROR_RATE ?? 0.01);
  private readonly successRateTarget = Number(process.env.OTA_SUCCESS_RATE ?? 0.95);

  constructor(private readonly prisma: PrismaService) {}

  private async requireChannel(
    campgroundId: string,
    channelId: string,
    select?: Record<string, boolean>,
  ) {
    const channel = await this.prisma.otaChannel.findFirst({
      where: { id: channelId, campgroundId },
      ...(select ? { select } : {}),
    });
    if (!channel) throw new NotFoundException("Channel not found");
    return channel;
  }

  private async requireMapping(
    campgroundId: string,
    mappingId: string,
    select?: Record<string, boolean>,
  ) {
    const mapping = await this.prisma.otaListingMapping.findFirst({
      where: { id: mappingId, OtaChannel: { campgroundId } },
      ...(select ? { select } : {}),
    });
    if (!mapping) throw new NotFoundException("Mapping not found");
    return mapping;
  }

  private defaultConfig(campgroundId: string): OtaConfig {
    return {
      campgroundId,
      provider: "Hipcamp",
      externalAccountId: "",
      propertyId: "",
      apiKey: "",
      channelId: "",
      notes: null,
      lastSyncStatus: "not_started",
      lastSyncMessage: "Not connected yet. Configure provider credentials to enable sync.",
      lastSyncAt: null,
      lastUpdatedAt: null,
      pendingSyncs: 0,
    };
  }

  getConfig(campgroundId: string) {
    return this.configStore.get(campgroundId) ?? this.defaultConfig(campgroundId);
  }

  saveConfig(campgroundId: string, payload: SaveOtaConfigDto) {
    const base = this.getConfig(campgroundId);
    const hasCredentials = payload.apiKey && payload.externalAccountId;
    const saved: OtaConfig = {
      ...base,
      ...payload,
      campgroundId,
      lastUpdatedAt: new Date().toISOString(),
      lastSyncStatus: hasCredentials ? base.lastSyncStatus : "not_started",
      lastSyncMessage: hasCredentials
        ? "Configuration saved. Ready to sync."
        : "Configuration saved. Add API credentials to enable sync.",
      pendingSyncs: 0,
      lastSyncAt: base.lastSyncAt,
    };
    this.configStore.set(campgroundId, saved);
    return saved;
  }

  getSyncStatus(campgroundId: string) {
    const config = this.getConfig(campgroundId);
    return {
      campgroundId,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncAt: config.lastSyncAt ?? null,
      lastSyncMessage: config.lastSyncMessage ?? "Not synced yet.",
      pendingSyncs: config.pendingSyncs ?? 0,
    };
  }

  async listChannels(campgroundId: string) {
    const channels = await this.prisma.otaChannel.findMany({
      where: { campgroundId },
      include: { OtaListingMapping: true },
      orderBy: { createdAt: "desc" },
    });
    return channels.map(({ OtaListingMapping, ...rest }) => ({
      ...rest,
      mappings: OtaListingMapping,
    }));
  }

  createChannel(campgroundId: string, data: CreateOtaChannelDto) {
    return this.prisma.otaChannel.create({
      data: {
        id: randomUUID(),
        campgroundId,
        name: data.name,
        provider: data.provider,
        status: data.status ?? "disabled",
        rateMultiplier: data.rateMultiplier ?? 1,
        defaultStatus: data.defaultStatus ?? "confirmed",
        sendEmailNotifications: data.sendEmailNotifications ?? false,
        ignoreSiteRestrictions: data.ignoreSiteRestrictions ?? false,
        ignoreCategoryRestrictions: data.ignoreCategoryRestrictions ?? false,
        feeMode: data.feeMode ?? "absorb",
        webhookSecret: data.webhookSecret,
        updatedAt: new Date(),
      },
    });
  }

  async updateChannel(id: string, campgroundId: string, data: UpdateOtaChannelDto) {
    await this.requireChannel(campgroundId, id, { id: true });
    return this.prisma.otaChannel.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async listMappings(channelId: string, campgroundId: string) {
    await this.requireChannel(campgroundId, channelId, { id: true });
    const mappings = await this.prisma.otaListingMapping.findMany({
      where: { channelId },
      include: {
        Site: { select: { id: true, name: true } },
        SiteClass: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return mappings.map(({ Site, SiteClass, ...rest }) => ({
      ...rest,
      site: Site,
      siteClass: SiteClass,
    }));
  }

  async upsertMapping(channelId: string, campgroundId: string, body: UpsertOtaMappingDto) {
    await this.requireChannel(campgroundId, channelId, { id: true });
    return this.prisma.otaListingMapping.upsert({
      where: { channelId_externalId: { channelId, externalId: body.externalId } },
      create: {
        id: randomUUID(),
        channelId,
        externalId: body.externalId,
        siteId: body.siteId ?? null,
        siteClassId: body.siteClassId ?? null,
        status: body.status ?? "mapped",
        updatedAt: new Date(),
      },
      update: {
        siteId: body.siteId ?? null,
        siteClassId: body.siteClassId ?? null,
        status: body.status ?? "mapped",
        updatedAt: new Date(),
      },
    });
  }

  async listImports(channelId: string, campgroundId: string) {
    await this.requireChannel(campgroundId, channelId, { id: true });
    return this.prisma.otaReservationImport.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async listSyncLogs(channelId: string, campgroundId: string) {
    await this.requireChannel(campgroundId, channelId, { id: true });
    return this.prisma.otaSyncLog.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  logSync(
    channelId: string,
    payload: unknown,
    direction: string,
    eventType: string,
    status: string,
    message?: string,
  ) {
    const payloadJson = toJsonValue(payload);
    return this.prisma.otaSyncLog.create({
      data: {
        id: randomUUID(),
        channelId,
        direction,
        eventType,
        status,
        message,
        payload: payloadJson,
      },
    });
  }

  private verifyHmac(raw: string, secret: string, signature?: string, timestamp?: string) {
    if (!secret) return true; // if no secret configured, accept
    if (!signature) throw new BadRequestException("Missing signature");

    // Optional timestamp freshness check (5 minutes)
    if (timestamp) {
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
        throw new BadRequestException("Signature expired");
      }
    }

    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    if (expected !== signature) {
      throw new BadRequestException("Invalid signature");
    }
    return true;
  }

  private readonly ICAL_TOKEN_EXPIRY_DAYS = 90;

  async ensureIcalToken(mappingId: string, campgroundId: string) {
    const mapping = await this.requireMapping(campgroundId, mappingId, {
      id: true,
      icalToken: true,
      icalTokenExpiresAt: true,
    });

    // Return existing token if valid and not expired
    if (
      mapping.icalToken &&
      mapping.icalTokenExpiresAt &&
      new Date(mapping.icalTokenExpiresAt) > new Date()
    ) {
      return mapping.icalToken;
    }

    // Generate new token with expiration
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.ICAL_TOKEN_EXPIRY_DAYS);

    await this.prisma.otaListingMapping.update({
      where: { id: mappingId },
      data: { icalToken: token, icalTokenExpiresAt: expiresAt },
    });
    return token;
  }

  async rotateIcalToken(mappingId: string, campgroundId: string) {
    await this.requireMapping(campgroundId, mappingId, { id: true });

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.ICAL_TOKEN_EXPIRY_DAYS);

    await this.prisma.otaListingMapping.update({
      where: { id: mappingId },
      data: { icalToken: token, icalTokenExpiresAt: expiresAt },
    });

    this.logger.log(`Rotated iCal token for mapping ${mappingId}`);
    return { token, expiresAt };
  }

  async setIcalUrl(mappingId: string, campgroundId: string, url: string) {
    await this.ensureIcalToken(mappingId, campgroundId);
    await this.prisma.otaListingMapping.update({
      where: { id: mappingId },
      data: { icalUrl: url || null },
    });
    return { ok: true };
  }

  private formatIcsDate(date: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z"
    );
  }

  async getIcsFeed(token: string) {
    const mapping = await this.prisma.otaListingMapping.findFirst({
      where: { icalToken: token },
      select: { id: true, siteId: true, channelId: true, icalTokenExpiresAt: true },
    });
    if (!mapping) throw new NotFoundException("Calendar not found");

    // Check token expiration
    if (mapping.icalTokenExpiresAt && new Date(mapping.icalTokenExpiresAt) < new Date()) {
      throw new BadRequestException(
        "Calendar token has expired. Please generate a new calendar link.",
      );
    }

    if (!mapping.siteId) throw new BadRequestException("Mapping is not linked to a site");

    const reservations = await this.prisma.reservation.findMany({
      where: { siteId: mapping.siteId, status: { not: "cancelled" } },
      select: { id: true, arrivalDate: true, departureDate: true, guestId: true, bookedAt: true },
      orderBy: { arrivalDate: "asc" },
      take: 500,
    });

    const blackouts = await this.prisma.blackoutDate.findMany({
      where: {
        OR: [{ siteId: mapping.siteId }, { siteId: null }],
      },
      select: { id: true, startDate: true, endDate: true, reason: true },
      orderBy: { startDate: "asc" },
      take: 200,
    });

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Keepr Host//OTA iCal//EN",
      "CALSCALE:GREGORIAN",
    ];

    for (const res of reservations) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${res.id}@keeprstay`,
        `DTSTAMP:${this.formatIcsDate(new Date(res.bookedAt || res.arrivalDate))}`,
        `DTSTART:${this.formatIcsDate(new Date(res.arrivalDate))}`,
        `DTEND:${this.formatIcsDate(new Date(res.departureDate))}`,
        "SUMMARY:Reservation (busy)",
        "END:VEVENT",
      );
    }

    for (const b of blackouts) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${b.id}@keeprstay`,
        `DTSTAMP:${this.formatIcsDate(new Date(b.startDate))}`,
        `DTSTART:${this.formatIcsDate(new Date(b.startDate))}`,
        `DTEND:${this.formatIcsDate(new Date(b.endDate))}`,
        `SUMMARY:Blocked${b.reason ? " - " + b.reason : ""}`,
        "END:VEVENT",
      );
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  async importIcal(mappingId: string, campgroundId: string) {
    const mapping = await this.prisma.otaListingMapping.findFirst({
      where: { id: mappingId, OtaChannel: { campgroundId } },
      select: { id: true, icalUrl: true, siteId: true, channelId: true },
    });
    if (!mapping) throw new NotFoundException("Mapping not found");
    if (!mapping.icalUrl) throw new BadRequestException("No iCal URL configured for this mapping");
    if (!mapping.siteId) throw new BadRequestException("Mapping missing siteId for import");

    const res = await fetch(mapping.icalUrl);
    if (!res.ok) throw new BadRequestException("Failed to fetch iCal feed");
    const text = await res.text();

    // Basic parser: collect DTSTART/DTEND pairs inside VEVENT
    const events: { start: Date; end: Date; summary?: string }[] = [];
    const blocks = text.split("BEGIN:VEVENT").slice(1);
    for (const block of blocks) {
      const dtStartMatch = block.match(/DTSTART[^:]*:([^\r\n]+)/);
      const dtEndMatch = block.match(/DTEND[^:]*:([^\r\n]+)/);
      if (!dtStartMatch || !dtEndMatch) continue;
      const start = new Date(dtStartMatch[1]);
      const end = new Date(dtEndMatch[1]);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      const summaryMatch = block.match(/SUMMARY:([^\r\n]+)/);
      events.push({ start, end, summary: summaryMatch?.[1] });
    }

    // Clear previous imported blocks for this mapping
    await this.prisma.blackoutDate.deleteMany({
      where: { siteId: mapping.siteId, reason: { contains: `[ical:${mapping.id}]` } },
    });

    if (events.length > 0) {
      await this.prisma.blackoutDate.createMany({
        data: events.map((e) => ({
          id: randomUUID(),
          campgroundId,
          siteId: mapping.siteId,
          startDate: e.start,
          endDate: e.end,
          reason: `${e.summary ?? "OTA iCal"} [ical:${mapping.id}]`,
        })),
        skipDuplicates: true,
      });
    }

    await this.logSync(
      mapping.channelId,
      { imported: events.length },
      "pull",
      "availability",
      "success",
      "iCal import",
    );
    this.recordSync("ical", campgroundId, true, "pull");
    return { ok: true, imported: events.length };
  }

  async handleWebhook(
    provider: string,
    body: unknown,
    rawBody: string,
    signature?: string,
    timestamp?: string,
  ) {
    const payload = isRecord(body) ? body : {};
    const channel = await this.prisma.otaChannel.findFirst({
      where: { provider },
      select: {
        id: true,
        webhookSecret: true,
        campgroundId: true,
        defaultStatus: true,
        rateMultiplier: true,
        feeMode: true,
      },
    });

    if (!channel?.id) {
      return { ok: true, ignored: true };
    }

    this.verifyHmac(rawBody, channel.webhookSecret || "", signature, timestamp);
    this.recordWebhook(provider, channel.campgroundId, true);

    // Idempotent import record
    const externalReservationId =
      getStringId(payload.id) ??
      getStringId(payload.reservationId) ??
      getStringId(payload.externalId) ??
      "unknown";
    const importRecord = await this.prisma.otaReservationImport.upsert({
      where: { channelId_externalReservationId: { channelId: channel.id, externalReservationId } },
      create: {
        id: randomUUID(),
        channelId: channel.id,
        externalReservationId,
        status: "pending",
        message: "Webhook received",
      },
      update: {
        status: "pending",
        message: "Webhook received",
      },
    });

    await this.logSync(channel.id, payload, "pull", "reservation", "success", "Webhook received");
    // Basic mapping check to surface quick failures
    const externalListingId =
      getStringId(payload.listingId) ??
      getStringId(payload.siteId) ??
      getStringId(payload.siteExternalId) ??
      getStringId(payload.listingExternalId) ??
      null;
    if (externalListingId) {
      const mapping = await this.prisma.otaListingMapping.findFirst({
        where: { channelId: channel.id, externalId: String(externalListingId) },
        select: { id: true, siteId: true, siteClassId: true },
      });
      if (!mapping) {
        await this.prisma.otaReservationImport.update({
          where: { id: importRecord.id },
          data: { status: "failed", message: "No mapping found for listing" },
        });
        await this.logSync(
          channel.id,
          payload,
          "pull",
          "reservation",
          "failed",
          "No mapping found",
        );
        return { ok: false, reason: "no_mapping" };
      }
      await this.prisma.otaReservationImport.update({
        where: { id: importRecord.id },
        data: { message: "Mapping found; pending processing", status: "pending" },
      });

      // Cancellation / modification handling
      const rawStatus =
        getString(payload.status) ??
        getString(payload.reservationStatus) ??
        getString(payload.state);
      const normalizedStatus = this.mapExternalStatus(rawStatus);
      if (normalizedStatus === "cancelled") {
        if (importRecord.reservationId) {
          await this.prisma.reservation.update({
            where: { id: importRecord.reservationId },
            data: { status: "cancelled" },
          });
          await this.prisma.otaReservationImport.update({
            where: { id: importRecord.id },
            data: { status: "imported", message: "Cancelled" },
          });
          await this.logSync(
            channel.id,
            payload,
            "pull",
            "reservation",
            "success",
            "Cancelled reservation",
          );
          this.recordSync(provider, channel.campgroundId, true, "pull");
          return {
            ok: true,
            importId: importRecord.id,
            reservationId: importRecord.reservationId,
            cancelled: true,
          };
        } else {
          await this.prisma.otaReservationImport.update({
            where: { id: importRecord.id },
            data: { status: "failed", message: "Cancellation received but reservation not found" },
          });
          await this.logSync(
            channel.id,
            payload,
            "pull",
            "reservation",
            "failed",
            "Cancellation without reservation",
          );
          return { ok: false, reason: "missing_reservation_for_cancel" };
        }
      }

      // Try to create reservation immediately with mapped site
      try {
        const result = await this.importReservationFromPayload({
          channelId: channel.id,
          campgroundId: channel.campgroundId,
          mappingId: mapping.id,
          siteId: mapping.siteId,
          siteClassId: mapping.siteClassId,
          payload,
          channelDefaultStatus: channel.defaultStatus,
          rateMultiplier: channel.rateMultiplier ?? 1,
          feeMode: channel.feeMode ?? "absorb",
        });

        await this.prisma.otaReservationImport.update({
          where: { id: importRecord.id },
          data: { status: "imported", message: "Imported", reservationId: result.reservationId },
        });
        await this.logSync(channel.id, payload, "pull", "reservation", "success", "Imported");
        return { ok: true, importId: importRecord.id, reservationId: result.reservationId };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        await this.prisma.otaReservationImport.update({
          where: { id: importRecord.id },
          data: { status: "failed", message },
        });
        await this.logSync(channel.id, payload, "pull", "reservation", "failed", message);
        return { ok: false, reason: "import_failed", error: message };
      }
    }

    return { ok: true, importId: importRecord.id };
  }

  private async importReservationFromPayload(opts: {
    channelId: string;
    campgroundId: string;
    mappingId: string;
    siteId?: string | null;
    siteClassId?: string | null;
    payload: Record<string, unknown>;
    channelDefaultStatus?: string;
    rateMultiplier?: number;
    feeMode?: string;
  }) {
    const { payload } = opts;
    const arrival = getDateValue(payload.arrivalDate) ?? getDateValue(payload.startDate);
    const departure = getDateValue(payload.departureDate) ?? getDateValue(payload.endDate);
    if (!arrival || !departure) throw new BadRequestException("Missing arrival/departure dates");

    const guestRecord = isRecord(payload.guest) ? payload.guest : undefined;
    const guestEmail =
      getString(payload.guestEmail) ?? getString(payload.email) ?? getString(guestRecord?.email);
    const guestFirst =
      getString(payload.guestFirstName) ??
      getString(payload.firstName) ??
      getString(guestRecord?.firstName) ??
      "OTA Guest";
    const guestLast =
      getString(payload.guestLastName) ??
      getString(payload.lastName) ??
      getString(guestRecord?.lastName) ??
      "Imported";
    if (!guestEmail) throw new BadRequestException("Missing guest email");

    const rateMultiplier = opts.rateMultiplier ?? 1;
    const baseSubtotal = Math.round(
      (getNumberValue(payload.baseSubtotalCents) ?? getNumberValue(payload.totalCents) ?? 0) *
        rateMultiplier,
    );
    const feesAmount = Math.round((getNumberValue(payload.feesCents) ?? 0) * rateMultiplier);
    const taxesAmount = Math.round((getNumberValue(payload.taxesCents) ?? 0) * rateMultiplier);
    const channelFeeCents = Math.round(
      (getNumberValue(payload.channelFeeCents) ?? getNumberValue(payload.commissionCents) ?? 0) *
        rateMultiplier,
    );
    const totalAmount = Math.max(0, baseSubtotal + feesAmount + taxesAmount);

    // Find or create guest
    const emailNormalized = guestEmail.trim().toLowerCase();
    const campgroundTag = `campground:${opts.campgroundId}`;
    const existingGuest = await this.prisma.guest.findFirst({
      where: {
        OR: [{ emailNormalized }, { email: guestEmail }],
      },
      select: { id: true, tags: true },
    });
    let guestId = existingGuest?.id;
    if (!guestId) {
      const guest = await this.prisma.guest.create({
        data: {
          id: randomUUID(),
          primaryFirstName: guestFirst,
          primaryLastName: guestLast,
          email: guestEmail,
          emailNormalized,
          tags: [campgroundTag],
        },
        select: { id: true },
      });
      guestId = guest.id;
    } else if (existingGuest?.tags && !existingGuest.tags.includes(campgroundTag)) {
      await this.prisma.guest.update({
        where: { id: guestId },
        data: { tags: { set: [...existingGuest.tags, campgroundTag] } },
      });
    }

    let siteId = opts.siteId;
    if (!siteId && opts.siteClassId) {
      siteId = await this.findAvailableSiteInClass(
        opts.campgroundId,
        opts.siteClassId,
        new Date(arrival),
        new Date(departure),
      );
    }
    if (!siteId) throw new BadRequestException("Mapping missing siteId");

    const rawStatus =
      getString(payload.status) ??
      getString(payload.reservationStatus) ??
      getString(payload.state) ??
      opts.channelDefaultStatus;
    const status = this.mapExternalStatus(rawStatus) ?? ReservationStatus.pending;

    const reservation = await this.prisma.reservation.create({
      data: {
        id: randomUUID(),
        campgroundId: opts.campgroundId,
        siteId,
        guestId,
        arrivalDate: arrival,
        departureDate: departure,
        adults: getNumberValue(payload.adults) ?? 2,
        children: getNumberValue(payload.children) ?? 0,
        status,
        totalAmount,
        baseSubtotal,
        feesAmount,
        taxesAmount,
        balanceAmount: totalAmount,
        source: getString(payload.provider) ?? getString(payload.channel) ?? "ota",
        notes: `Imported from ${getString(payload.provider) ?? "OTA"} | extRes: ${getStringId(payload.id) ?? "n/a"}`,
        bookedAt: getDateValue(payload.bookedAt) ?? new Date(),
      },
      select: { id: true },
    });

    // Ledger entries: revenue + channel fee (if provided)
    const entries: Prisma.LedgerEntryCreateManyInput[] = [];
    if (totalAmount > 0) {
      entries.push({
        id: randomUUID(),
        campgroundId: opts.campgroundId,
        reservationId: reservation.id,
        amountCents: totalAmount,
        direction: "credit",
        description: `OTA ${payload?.provider || "channel"} booking revenue`,
      });
    }
    if (channelFeeCents > 0) {
      entries.push({
        id: randomUUID(),
        campgroundId: opts.campgroundId,
        reservationId: reservation.id,
        amountCents: channelFeeCents,
        direction: opts.feeMode === "pass_through" ? "credit" : "debit",
        description: `OTA channel fee (${opts.feeMode === "pass_through" ? "pass-through" : "absorbed"})`,
      });
    }
    if (entries.length > 0) {
      await this.prisma.ledgerEntry.createMany({ data: entries });
    }

    return { reservationId: reservation.id };
  }

  private mapExternalStatus(raw?: string | null): ReservationStatus | null {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    if (["cancelled", "canceled", "void"].includes(s)) return ReservationStatus.cancelled;
    if (["pending", "tentative", "unconfirmed", "hold"].includes(s))
      return ReservationStatus.pending;
    return ReservationStatus.confirmed;
  }

  /**
   * Find an available site within a site class for the given date range.
   */
  private async findAvailableSiteInClass(
    campgroundId: string,
    siteClassId: string,
    arrival: Date,
    departure: Date,
  ): Promise<string | null> {
    const sites = await this.prisma.site.findMany({
      where: { campgroundId, siteClassId, isActive: true },
      select: { id: true },
    });
    if (!sites?.length) return null;

    for (const s of sites) {
      const overlap = await this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int as count
        FROM "Reservation" r
        WHERE r."siteId" = ${s.id}
          AND r."status" != 'cancelled'
          AND tstzrange(r."arrivalDate", r."departureDate", '[)'::text) && tstzrange(${arrival}, ${departure}, '[)'::text)
      `;
      const count = overlap?.[0]?.count ?? 0;
      if (count > 0) continue;

      const blackoutCount = await this.prisma.blackoutDate.count({
        where: {
          campgroundId,
          OR: [{ siteId: s.id }, { siteId: null }],
          startDate: { lt: departure },
          endDate: { gt: arrival },
        },
      });
      if (blackoutCount > 0) continue;

      return s.id;
    }
    return null;
  }

  /**
   * Push availability and pricing data to OTA provider for all mapped listings.
   * This method orchestrates the sync process, handles errors, and updates sync status.
   */
  async pushAvailability(channelId: string, campgroundId: string) {
    const channel = await this.prisma.otaChannel.findFirst({
      where: { id: channelId, campgroundId },
      select: { id: true, campgroundId: true, name: true, status: true, provider: true },
    });
    if (!channel) throw new NotFoundException("Channel not found");

    // Check if channel is active
    if (channel.status === "disabled") {
      const message = "Channel is disabled. Enable it to sync availability.";
      await this.logSync(
        channelId,
        { reason: "disabled" },
        "push",
        "availability",
        "failed",
        message,
      );
      throw new BadRequestException(message);
    }

    const mappings = await this.prisma.otaListingMapping.findMany({
      where: { channelId },
      select: { id: true, externalId: true, siteId: true, siteClassId: true, status: true },
    });

    if (mappings.length === 0) {
      const message = "No mappings found for this channel. Create site mappings first.";
      await this.logSync(
        channelId,
        { reason: "no_mappings" },
        "push",
        "availability",
        "failed",
        message,
      );
      throw new BadRequestException(message);
    }

    const now = new Date();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Get OTA config to check for credentials
    const config = this.getConfig(channel.campgroundId);
    const hasCredentials = config.apiKey && config.externalAccountId;

    if (!hasCredentials) {
      const message =
        "OTA provider credentials not configured. Add API key and account ID in settings.";
      await this.logSync(
        channelId,
        { reason: "missing_credentials" },
        "push",
        "availability",
        "failed",
        message,
      );
      this.recordSync(channel.provider ?? "unknown", channel.campgroundId, false, "push");
      throw new BadRequestException(message);
    }

    this.logger.log(
      `Starting availability push for channel ${channelId} (${channel.provider}) with ${mappings.length} mappings`,
    );

    for (const m of mappings) {
      // Skip disabled mappings
      if (m.status === "disabled") {
        errorCount++;
        errors.push(`Mapping ${m.externalId}: disabled`);
        await this.prisma.otaListingMapping.update({
          where: { id: m.id },
          data: { lastSyncAt: now, lastError: "Mapping disabled" },
        });
        continue;
      }

      // Validate mapping has required site assignment
      if (!m.siteId) {
        errorCount++;
        errors.push(`Mapping ${m.externalId}: missing site assignment`);
        await this.prisma.otaListingMapping.update({
          where: { id: m.id },
          data: { lastSyncAt: now, lastError: "Missing site mapping" },
        });
        continue;
      }

      try {
        // Prepare availability data for this listing
        const availabilityData = await this.prepareAvailabilityData(
          channel.campgroundId,
          m.siteId,
          m.externalId,
        );

        // TODO: Call actual OTA provider API here
        // This is where the real API integration will go once credentials are available
        // Example structure for different providers:
        //
        // switch (channel.provider) {
        //   case "Hipcamp":
        //     await this.pushToHipcamp(config, m.externalId, availabilityData);
        //     break;
        //   case "Airbnb":
        //     await this.pushToAirbnb(config, m.externalId, availabilityData);
        //     break;
        //   case "Booking.com":
        //     await this.pushToBookingDotCom(config, m.externalId, availabilityData);
        //     break;
        //   default:
        //     throw new Error(`Unsupported provider: ${channel.provider}`);
        // }

        // For now, log the sync attempt
        this.logger.log(
          `Would push to ${channel.provider} for listing ${m.externalId}: ${JSON.stringify({
            externalId: m.externalId,
            siteId: m.siteId,
            dates: availabilityData.length,
          })}`,
        );

        // Update mapping sync status
        await this.prisma.otaListingMapping.update({
          where: { id: m.id },
          data: { lastSyncAt: now, lastError: null },
        });

        successCount++;
      } catch (error: unknown) {
        errorCount++;
        const errorMsg = getErrorMessage(error);
        errors.push(`Mapping ${m.externalId}: ${errorMsg}`);

        this.logger.error(`Error pushing listing ${m.externalId}: ${errorMsg}`);

        // Update mapping with error
        await this.prisma.otaListingMapping.update({
          where: { id: m.id },
          data: { lastSyncAt: now, lastError: errorMsg },
        });

        // Log individual sync failure
        await this.logSync(
          channelId,
          { externalId: m.externalId, error: errorMsg },
          "push",
          "availability",
          "failed",
          `Failed to sync listing ${m.externalId}: ${errorMsg}`,
        );
      }
    }

    // Update channel sync timestamp
    await this.prisma.otaChannel.update({
      where: { id: channelId },
      data: { lastSyncAt: now },
    });

    // Determine overall sync status
    const syncStatus = errorCount === 0 ? "success" : successCount === 0 ? "failed" : "partial";
    const syncMessage =
      errorCount === 0
        ? `Successfully synced ${successCount} listing${successCount !== 1 ? "s" : ""}`
        : successCount === 0
          ? `Failed to sync all ${errorCount} listing${errorCount !== 1 ? "s" : ""}`
          : `Synced ${successCount} listing${successCount !== 1 ? "s" : ""} with ${errorCount} error${errorCount !== 1 ? "s" : ""}`;

    const payload = {
      total: mappings.length,
      successCount,
      errorCount,
      errors: errors.slice(0, 10), // Limit error list to first 10
    };

    // Log overall sync result
    await this.logSync(channelId, payload, "push", "availability", syncStatus, syncMessage);

    // Record sync metrics
    this.recordSync(channel.provider ?? "unknown", channel.campgroundId, errorCount === 0, "push");

    // Update config sync status
    const updatedConfig = this.getConfig(channel.campgroundId);
    updatedConfig.lastSyncAt = now.toISOString();
    updatedConfig.lastSyncStatus = errorCount === 0 ? "ok" : successCount > 0 ? "partial" : "error";
    updatedConfig.lastSyncMessage = syncMessage;
    updatedConfig.pendingSyncs = errorCount;
    this.configStore.set(channel.campgroundId, updatedConfig);

    this.logger.log(`Completed: ${syncMessage}`);

    return {
      ok: errorCount < mappings.length,
      total: mappings.length,
      successCount,
      errorCount,
      errors,
    };
  }

  /**
   * Prepare availability and pricing data for a specific site to send to OTA provider.
   * Retrieves current reservations and blackout dates to determine available dates.
   */
  private async prepareAvailabilityData(campgroundId: string, siteId: string, externalId: string) {
    // Get date range for sync (e.g., next 90 days)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    // Get existing reservations for this site
    const reservations = await this.prisma.reservation.findMany({
      where: {
        siteId,
        status: { not: "cancelled" },
        arrivalDate: { lt: endDate },
        departureDate: { gt: startDate },
      },
      select: { arrivalDate: true, departureDate: true },
    });

    // Get blackout dates
    const blackouts = await this.prisma.blackoutDate.findMany({
      where: {
        campgroundId,
        OR: [{ siteId }, { siteId: null }],
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: { startDate: true, endDate: true },
    });

    // Build availability calendar
    const availability: Array<{ date: string; available: boolean; price?: number }> = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const isBlocked =
        reservations.some(
          (r) => current >= new Date(r.arrivalDate) && current < new Date(r.departureDate),
        ) ||
        blackouts.some((b) => current >= new Date(b.startDate) && current < new Date(b.endDate));

      availability.push({
        date: dateStr,
        available: !isBlocked,
        // TODO: Calculate actual pricing based on site rates, seasonal pricing, etc.
        price: !isBlocked ? 5000 : undefined, // Placeholder: $50.00 in cents
      });

      current.setDate(current.getDate() + 1);
    }

    this.logger.log(
      `Prepared ${availability.length} days of availability for site ${siteId} (external: ${externalId})`,
    );
    return availability;
  }

  // TODO: Implement provider-specific API methods
  // These methods will be implemented when real OTA provider credentials are available
  //
  // private async pushToHipcamp(config: OtaConfig, externalId: string, availability: any[]) {
  //   // Implementation for Hipcamp API
  //   const response = await fetch(`https://api.hipcamp.com/v1/listings/${externalId}/availability`, {
  //     method: 'PUT',
  //     headers: {
  //       'Authorization': `Bearer ${config.apiKey}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ availability }),
  //   });
  //   if (!response.ok) throw new Error(`Hipcamp API error: ${response.statusText}`);
  //   return response.json();
  // }
  //
  // private async pushToAirbnb(config: OtaConfig, externalId: string, availability: any[]) {
  //   // Implementation for Airbnb API
  // }
  //
  // private async pushToBookingDotCom(config: OtaConfig, externalId: string, availability: any[]) {
  //   // Implementation for Booking.com API
  // }

  monitor() {
    return Array.from(this.stats.values()).map((s) => {
      const successTotal = s.success + s.failure;
      const successRate = successTotal === 0 ? 1 : s.success / successTotal;
      const webhookTotal = s.webhookSuccess + s.webhookFailure;
      const webhookErrorRate = webhookTotal === 0 ? 0 : s.webhookFailure / webhookTotal;
      const ageMinutes = s.lastSuccessAt ? (Date.now() - s.lastSuccessAt) / 60000 : Infinity;
      return {
        provider: s.provider,
        campgroundId: s.campgroundId,
        lastSuccessAt: s.lastSuccessAt ?? null,
        lastFailureAt: s.lastFailureAt ?? null,
        successRate,
        ageMinutes,
        webhookErrorRate,
        webhookLastFailureAt: s.lastWebhookFailureAt ?? null,
      };
    });
  }

  alerts() {
    const monitors = this.monitor();
    const freshnessBreaches = monitors
      .filter((m) => m.ageMinutes === Infinity || m.ageMinutes > this.freshnessMinutes)
      .map((m) => ({
        provider: m.provider,
        campgroundId: m.campgroundId,
        ageMinutes: m.ageMinutes,
      }));
    const webhookBreaches = monitors
      .filter((m) => m.webhookErrorRate > this.webhookErrorRateTarget)
      .map((m) => ({
        provider: m.provider,
        campgroundId: m.campgroundId,
        webhookErrorRate: m.webhookErrorRate,
      }));
    const successBreaches = monitors
      .filter((m) => (m.successRate ?? 1) < this.successRateTarget)
      .map((m) => ({
        provider: m.provider,
        campgroundId: m.campgroundId,
        successRate: m.successRate ?? 1,
      }));

    return {
      thresholds: {
        freshnessMinutes: this.freshnessMinutes,
        webhookErrorRate: this.webhookErrorRateTarget,
        successRate: this.successRateTarget,
      },
      freshnessBreaches,
      webhookBreaches,
      successBreaches,
    };
  }

  private recordSync(
    provider: string,
    campgroundId: string,
    ok: boolean,
    _direction: "push" | "pull",
  ) {
    const key = `${provider}:${campgroundId}`;
    const s = this.stats.get(key) ?? {
      provider,
      campgroundId,
      success: 0,
      failure: 0,
      webhookFailure: 0,
      webhookSuccess: 0,
    };
    if (ok) {
      s.success += 1;
      s.lastSuccessAt = Date.now();
    } else {
      s.failure += 1;
      s.lastFailureAt = Date.now();
    }
    this.stats.set(key, s);
  }

  private recordWebhook(provider: string, campgroundId: string, ok: boolean) {
    const key = `${provider}:${campgroundId}`;
    const s = this.stats.get(key) ?? {
      provider,
      campgroundId,
      success: 0,
      failure: 0,
      webhookFailure: 0,
      webhookSuccess: 0,
    };
    if (ok) {
      s.webhookSuccess += 1;
      s.lastWebhookSuccessAt = Date.now();
    } else {
      s.webhookFailure += 1;
      s.lastWebhookFailureAt = Date.now();
    }
    this.stats.set(key, s);
  }
}
