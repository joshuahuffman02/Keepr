import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
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
  lastSyncStatus: "not_started" | "stubbed" | "ok" | "error";
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

@Injectable()
export class OtaService {
  private readonly configStore = new Map<string, OtaConfig>();
  private readonly stats = new Map<string, OtaStats>();
  private readonly freshnessMinutes = Number(process.env.OTA_SYNC_MAX_AGE_MINUTES ?? 15);
  private readonly webhookErrorRateTarget = Number(process.env.OTA_WEBHOOK_ERROR_RATE ?? 0.01);
  private readonly successRateTarget = Number(process.env.OTA_SUCCESS_RATE ?? 0.95);

  constructor(private readonly prisma: PrismaService) {}

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
      lastSyncMessage: "Not connected yet. This endpoint is stubbed.",
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
    const saved: OtaConfig = {
      ...base,
      ...payload,
      campgroundId,
      lastUpdatedAt: new Date().toISOString(),
      lastSyncStatus: "stubbed",
      lastSyncMessage: "Saved locally. External provider calls are not wired yet.",
      pendingSyncs: 0,
      lastSyncAt: base.lastSyncAt ?? new Date().toISOString(),
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

  listChannels(campgroundId: string) {
    return (this.prisma as any).otaChannel.findMany({
      where: { campgroundId },
      include: { mappings: true },
      orderBy: { createdAt: "desc" },
    });
  }

  createChannel(campgroundId: string, data: CreateOtaChannelDto) {
    return (this.prisma as any).otaChannel.create({
      data: {
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
      },
    });
  }

  updateChannel(id: string, data: UpdateOtaChannelDto) {
    return (this.prisma as any).otaChannel.update({
      where: { id },
      data,
    });
  }

  listMappings(channelId: string) {
    return (this.prisma as any).otaListingMapping.findMany({
      where: { channelId },
      include: {
        site: { select: { id: true, name: true } },
        siteClass: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  upsertMapping(channelId: string, body: UpsertOtaMappingDto) {
    return (this.prisma as any).otaListingMapping.upsert({
      where: { channelId_externalId: { channelId, externalId: body.externalId } },
      create: {
        channelId,
        externalId: body.externalId,
        siteId: body.siteId ?? null,
        siteClassId: body.siteClassId ?? null,
        status: body.status ?? "mapped",
      },
      update: {
        siteId: body.siteId ?? null,
        siteClassId: body.siteClassId ?? null,
        status: body.status ?? "mapped",
        updatedAt: new Date(),
      },
    });
  }

  listImports(channelId: string) {
    return (this.prisma as any).otaReservationImport.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  listSyncLogs(channelId: string) {
    return (this.prisma as any).otaSyncLog.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  logSync(channelId: string, payload: unknown, direction: string, eventType: string, status: string, message?: string) {
    return (this.prisma as any).otaSyncLog.create({
      data: {
        channelId,
        direction,
        eventType,
        status,
        message,
        payload: payload as any,
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

  async ensureIcalToken(mappingId: string) {
    const mapping = await (this.prisma as any).otaListingMapping.findUnique({
      where: { id: mappingId },
      select: { id: true, icalToken: true },
    });
    if (!mapping) throw new NotFoundException("Mapping not found");
    if (mapping.icalToken) return mapping.icalToken;

    const token = randomUUID();
    await (this.prisma as any).otaListingMapping.update({
      where: { id: mappingId },
      data: { icalToken: token },
    });
    return token;
  }

  async setIcalUrl(mappingId: string, url: string) {
    await this.ensureIcalToken(mappingId);
    await (this.prisma as any).otaListingMapping.update({
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
    const mapping = await (this.prisma as any).otaListingMapping.findFirst({
      where: { icalToken: token },
      select: { id: true, siteId: true, channelId: true },
    });
    if (!mapping) throw new NotFoundException("Calendar not found");
    if (!mapping.siteId) throw new BadRequestException("Mapping is not linked to a site");

    const reservations = await (this.prisma as any).reservation.findMany({
      where: { siteId: mapping.siteId, status: { not: "cancelled" } },
      select: { id: true, arrivalDate: true, departureDate: true, guestId: true, bookedAt: true },
      orderBy: { arrivalDate: "asc" },
      take: 500,
    });

    const blackouts = await (this.prisma as any).blackoutDate.findMany({
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
      "PRODID:-//Campreserv//OTA iCal//EN",
      "CALSCALE:GREGORIAN",
    ];

    for (const res of reservations) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${res.id}@campreserv`,
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
        `UID:${b.id}@campreserv`,
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

  async importIcal(mappingId: string) {
    const mapping = await (this.prisma as any).otaListingMapping.findUnique({
      where: { id: mappingId },
      select: { id: true, icalUrl: true, siteId: true, channelId: true, channel: { select: { campgroundId: true } } },
    });
    if (!mapping) throw new NotFoundException("Mapping not found");
    if (!mapping.icalUrl) throw new BadRequestException("No iCal URL configured for this mapping");
    if (!mapping.siteId) throw new BadRequestException("Mapping missing siteId for import");
    const campgroundId = mapping.channel?.campgroundId;
    if (!campgroundId) throw new BadRequestException("Mapping missing campground context");

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
    await (this.prisma as any).blackoutDate.deleteMany({
      where: { siteId: mapping.siteId, reason: { contains: `[ical:${mapping.id}]` } },
    });

    if (events.length > 0) {
      await (this.prisma as any).blackoutDate.createMany({
        data: events.map((e) => ({
          campgroundId,
          siteId: mapping.siteId,
          startDate: e.start,
          endDate: e.end,
          reason: `${e.summary ?? "OTA iCal"} [ical:${mapping.id}]`,
        })),
        skipDuplicates: true,
      });
    }

    await this.logSync(mapping.channelId, { imported: events.length }, "pull", "availability", "success", "iCal import");
    this.recordSync("ical", campgroundId, true, "pull");
    return { ok: true, imported: events.length };
  }

  async handleWebhook(provider: string, body: any, rawBody: string, signature?: string, timestamp?: string) {
    const channel = await (this.prisma as any).otaChannel.findFirst({
      where: { provider },
      select: { id: true, webhookSecret: true, campgroundId: true, defaultStatus: true, rateMultiplier: true, feeMode: true },
    });

    if (!channel?.id) {
      return { ok: true, ignored: true };
    }

    this.verifyHmac(rawBody, channel.webhookSecret || "", signature, timestamp);
    this.recordWebhook(provider, channel.campgroundId, true);

    // Idempotent import record
    const externalReservationId = body?.id || body?.reservationId || body?.externalId || "unknown";
    const importRecord = await (this.prisma as any).otaReservationImport.upsert({
      where: { channelId_externalReservationId: { channelId: channel.id, externalReservationId } },
      create: {
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

    await this.logSync(channel.id, body, "pull", "reservation", "success", "Webhook received");
    // Basic mapping check to surface quick failures
    const externalListingId = body?.listingId || body?.siteId || body?.siteExternalId || body?.listingExternalId || null;
    if (externalListingId) {
      const mapping = await (this.prisma as any).otaListingMapping.findFirst({
        where: { channelId: channel.id, externalId: String(externalListingId) },
        select: { id: true, siteId: true, siteClassId: true },
      });
      if (!mapping) {
        await (this.prisma as any).otaReservationImport.update({
          where: { id: importRecord.id },
          data: { status: "failed", message: "No mapping found for listing", updatedAt: new Date() },
        });
        await this.logSync(channel.id, body, "pull", "reservation", "failed", "No mapping found");
        return { ok: false, reason: "no_mapping" };
      }
      await (this.prisma as any).otaReservationImport.update({
        where: { id: importRecord.id },
        data: { message: "Mapping found; pending processing", status: "pending", updatedAt: new Date() },
      });

      // Cancellation / modification handling
      const normalizedStatus = this.mapExternalStatus(body?.status || body?.reservationStatus || body?.state);
      if (normalizedStatus === "cancelled") {
        if (importRecord.reservationId) {
          await (this.prisma as any).reservation.update({
            where: { id: importRecord.reservationId },
            data: { status: "cancelled" },
          });
          await (this.prisma as any).otaReservationImport.update({
            where: { id: importRecord.id },
            data: { status: "imported", message: "Cancelled", updatedAt: new Date() },
          });
          await this.logSync(channel.id, body, "pull", "reservation", "success", "Cancelled reservation");
          this.recordSync(provider, channel.campgroundId, true, "pull");
          return { ok: true, importId: importRecord.id, reservationId: importRecord.reservationId, cancelled: true };
        } else {
          await (this.prisma as any).otaReservationImport.update({
            where: { id: importRecord.id },
            data: { status: "failed", message: "Cancellation received but reservation not found", updatedAt: new Date() },
          });
          await this.logSync(channel.id, body, "pull", "reservation", "failed", "Cancellation without reservation");
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
          payload: body,
          channelDefaultStatus: channel.defaultStatus,
          rateMultiplier: channel.rateMultiplier ?? 1,
          feeMode: channel.feeMode ?? "absorb",
        });

        await (this.prisma as any).otaReservationImport.update({
          where: { id: importRecord.id },
          data: { status: "imported", message: "Imported", reservationId: result.reservationId, updatedAt: new Date() },
        });
        await this.logSync(channel.id, body, "pull", "reservation", "success", "Imported");
        return { ok: true, importId: importRecord.id, reservationId: result.reservationId };
      } catch (err: any) {
        await (this.prisma as any).otaReservationImport.update({
          where: { id: importRecord.id },
          data: { status: "failed", message: err?.message || "Import failed", updatedAt: new Date() },
        });
        await this.logSync(channel.id, body, "pull", "reservation", "failed", err?.message || "Import failed");
        return { ok: false, reason: "import_failed", error: err?.message };
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
    payload: any;
    channelDefaultStatus?: string;
    rateMultiplier?: number;
    feeMode?: string;
  }) {
    const { payload } = opts;
    const arrival = payload?.arrivalDate || payload?.startDate;
    const departure = payload?.departureDate || payload?.endDate;
    if (!arrival || !departure) throw new BadRequestException("Missing arrival/departure dates");

    const guestEmail = payload?.guestEmail || payload?.email || payload?.guest?.email;
    const guestFirst = payload?.guestFirstName || payload?.firstName || payload?.guest?.firstName || "OTA Guest";
    const guestLast = payload?.guestLastName || payload?.lastName || payload?.guest?.lastName || "Imported";
    if (!guestEmail) throw new BadRequestException("Missing guest email");

    const rateMultiplier = opts.rateMultiplier ?? 1;
    const baseSubtotal = Math.round((payload?.baseSubtotalCents ?? payload?.totalCents ?? 0) * rateMultiplier);
    const feesAmount = Math.round((payload?.feesCents ?? 0) * rateMultiplier);
    const taxesAmount = Math.round((payload?.taxesCents ?? 0) * rateMultiplier);
    const channelFeeCents = Math.round((payload?.channelFeeCents ?? payload?.commissionCents ?? 0) * rateMultiplier);
    const totalAmount = Math.max(0, baseSubtotal + feesAmount + taxesAmount);

    // Find or create guest
    const existingGuest = await (this.prisma as any).guest.findFirst({
      where: { email: guestEmail, campgroundId: opts.campgroundId },
      select: { id: true },
    });
    let guestId = existingGuest?.id;
    if (!guestId) {
      const guest = await (this.prisma as any).guest.create({
        data: {
          campgroundId: opts.campgroundId,
          firstName: guestFirst,
          lastName: guestLast,
          email: guestEmail,
        },
        select: { id: true },
      });
      guestId = guest.id;
    }

    let siteId = opts.siteId;
    if (!siteId && opts.siteClassId) {
      siteId = await this.findAvailableSiteInClass(opts.campgroundId, opts.siteClassId, new Date(arrival), new Date(departure));
    }
    if (!siteId) throw new BadRequestException("Mapping missing siteId");

    const status = this.mapExternalStatus(payload?.status || payload?.reservationStatus || payload?.state) || (opts.channelDefaultStatus ?? "pending");

    const reservation = await (this.prisma as any).reservation.create({
      data: {
        campgroundId: opts.campgroundId,
        siteId,
        guestId,
        arrivalDate: new Date(arrival),
        departureDate: new Date(departure),
        adults: payload?.adults ?? 2,
        children: payload?.children ?? 0,
        status: status as any,
        totalAmount,
        baseSubtotal,
        feesAmount,
        taxesAmount,
        balanceAmount: totalAmount,
        source: payload?.provider ?? payload?.channel ?? "ota",
        notes: `Imported from ${payload?.provider || "OTA"} | extRes: ${payload?.id ?? "n/a"}`,
        bookedAt: payload?.bookedAt ? new Date(payload.bookedAt) : new Date(),
      },
      select: { id: true },
    });

    // Ledger entries: revenue + channel fee (if provided)
    const entries: any[] = [];
    if (totalAmount > 0) {
      entries.push({
        campgroundId: opts.campgroundId,
        reservationId: reservation.id,
        amountCents: totalAmount,
        direction: "credit",
        description: `OTA ${payload?.provider || "channel"} booking revenue`,
      });
    }
    if (channelFeeCents > 0) {
      entries.push({
        campgroundId: opts.campgroundId,
        reservationId: reservation.id,
        amountCents: channelFeeCents,
        direction: opts.feeMode === "pass_through" ? "credit" : "debit",
        description: `OTA channel fee (${opts.feeMode === "pass_through" ? "pass-through" : "absorbed"})`,
      });
    }
    if (entries.length > 0) {
      await (this.prisma as any).ledgerEntry.createMany({ data: entries });
    }

    return { reservationId: reservation.id };
  }

  private mapExternalStatus(raw?: string): string | null {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    if (["cancelled", "canceled", "void"].includes(s)) return "cancelled";
    if (["pending", "tentative", "unconfirmed", "hold"].includes(s)) return "pending";
    return "confirmed";
  }

  /**
   * Find an available site within a site class for the given date range.
   */
  private async findAvailableSiteInClass(campgroundId: string, siteClassId: string, arrival: Date, departure: Date): Promise<string | null> {
    const sites = await (this.prisma as any).site.findMany({
      where: { campgroundId, siteClassId, isActive: true },
      select: { id: true },
    });
    if (!sites?.length) return null;

    for (const s of sites) {
      const overlap = await (this.prisma as any).$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int as count
        FROM "Reservation" r
        WHERE r."siteId" = ${s.id}
          AND r."status" != 'cancelled'
          AND tstzrange(r."arrivalDate", r."departureDate", '[)'::text) && tstzrange(${arrival}, ${departure}, '[)'::text)
      `;
      const count = overlap?.[0]?.count ?? 0;
      if (count > 0) continue;

      const blackoutCount = await (this.prisma as any).blackoutDate.count({
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
   * Manual availability/pricing push placeholder. In a real integration, this
   * would call the OTA provider API per mapped listing and enqueue retries.
   */
  async pushAvailability(channelId: string) {
    const channel = await (this.prisma as any).otaChannel.findUnique({
      where: { id: channelId },
      select: { id: true, campgroundId: true, name: true, status: true, provider: true },
    });
    if (!channel) throw new NotFoundException("Channel not found");

    const mappings = await (this.prisma as any).otaListingMapping.findMany({
      where: { channelId },
      select: { id: true, externalId: true, siteId: true, siteClassId: true, status: true },
    });

    const now = new Date();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const m of mappings) {
      if (m.status === "disabled") {
        errorCount++;
        await (this.prisma as any).otaListingMapping.update({
          where: { id: m.id },
          data: { lastSyncAt: now, lastError: "Mapping disabled" },
        });
        continue;
      }
      if (!m.siteId) {
        errorCount++;
        await (this.prisma as any).otaListingMapping.update({
          where: { id: m.id },
          data: { lastSyncAt: now, lastError: "Missing site mapping" },
        });
        continue;
      }

      // Stub push; a real integration would call provider API here.
      await (this.prisma as any).otaListingMapping.update({
        where: { id: m.id },
        data: { lastSyncAt: now, lastError: null },
      });
      successCount++;
    }

    await (this.prisma as any).otaChannel.update({
      where: { id: channelId },
      data: { lastSyncAt: now },
    });

    const payload = {
      total: mappings.length,
      successCount,
      errorCount,
    };

    await this.logSync(
      channelId,
      payload,
      "push",
      "availability",
      errorCount > 0 ? "failed" : "success",
      errorCount > 0 ? `Pushed with ${errorCount} errors` : "Availability/pricing push succeeded"
    );
    this.recordSync(channel.provider ?? "unknown", channel.campgroundId, errorCount === 0, "push");
    return { ok: true, total: mappings.length, successCount, errorCount };
  }

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
      .map((m) => ({ provider: m.provider, campgroundId: m.campgroundId, ageMinutes: m.ageMinutes }));
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

  private recordSync(provider: string, campgroundId: string, ok: boolean, _direction: "push" | "pull") {
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

