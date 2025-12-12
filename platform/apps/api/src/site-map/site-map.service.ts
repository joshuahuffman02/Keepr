import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CheckAssignmentDto } from "./dto/check-assignment.dto";
import { PreviewAssignmentsDto } from "./dto/preview-assignments.dto";
import { UpsertMapDto } from "./dto/upsert-map.dto";

type ConflictType = "reservation" | "hold" | "maintenance" | "blackout";

interface Conflict {
  type: ConflictType;
  id: string;
  start?: Date;
  end?: Date;
  status?: string | null;
  reason?: string | null;
}

type AssignmentReason =
  | "rig_too_long"
  | "rig_too_wide"
  | "rig_too_tall"
  | "ada_required"
  | "missing_amenities"
  | "party_too_large"
  | "status_blocked";

@Injectable()
export class SiteMapService {
  constructor(private readonly prisma: PrismaService) {}

  async getMap(campgroundId: string, startDate?: string, endDate?: string) {
    const [layouts, config] = await this.prisma.$transaction([
      this.prisma.siteMapLayout.findMany({
        where: { campgroundId },
        include: { site: true }
      }),
      this.prisma.campgroundMapConfig.findUnique({ where: { campgroundId } })
    ]);

    let conflictsBySite: Record<string, Conflict[]> = {};
    if (startDate && endDate) {
      const { start, end } = this.parseDates(startDate, endDate);
      conflictsBySite = await this.buildConflictsMap(campgroundId, layouts.map(l => l.siteId), start, end);
    }

    return {
      config: config ?? null,
      sites: layouts.map(layout => ({
        siteId: layout.siteId,
        name: layout.site.name,
        siteNumber: layout.site.siteNumber,
        geometry: layout.geometry,
        centroid: layout.centroid,
        label: layout.label ?? layout.site.mapLabel ?? layout.site.name,
        rotation: layout.rotation,
        ada: layout.site.accessible,
        amenityTags: (layout.site.amenityTags?.length ? layout.site.amenityTags : layout.site.tags) ?? [],
        rigConstraints: {
          length: layout.site.rigMaxLength ?? null,
          width: layout.site.rigMaxWidth ?? null,
          height: layout.site.rigMaxHeight ?? null,
          pullThrough: layout.site.pullThrough ?? false
        },
        hookups: {
          power: layout.site.hookupsPower,
          powerAmps: layout.site.powerAmps,
          water: layout.site.hookupsWater,
          sewer: layout.site.hookupsSewer
        },
        status: layout.site.status ?? null,
        conflicts: conflictsBySite[layout.siteId] ?? []
      }))
    };
  }

  async upsertMap(campgroundId: string, dto: UpsertMapDto) {
    const ops: Prisma.PrismaPromise<any>[] = [];
    const siteIds = dto.sites?.map(s => s.siteId) ?? [];

    if (siteIds.length) {
      const count = await this.prisma.site.count({ where: { id: { in: siteIds }, campgroundId } });
      if (count !== siteIds.length) {
        throw new BadRequestException("One or more sites do not belong to this campground");
      }
    }

    if (dto.config) {
      ops.push(
        this.prisma.campgroundMapConfig.upsert({
          where: { campgroundId },
          update: {
            bounds: dto.config.bounds ?? null,
            defaultCenter: dto.config.defaultCenter ?? null,
            defaultZoom: dto.config.defaultZoom ?? null,
            layers: dto.config.layers ?? null,
            legend: dto.config.legend ?? null
          },
          create: {
            campgroundId,
            bounds: dto.config.bounds ?? null,
            defaultCenter: dto.config.defaultCenter ?? null,
            defaultZoom: dto.config.defaultZoom ?? null,
            layers: dto.config.layers ?? null,
            legend: dto.config.legend ?? null
          }
        })
      );
    }

    if (dto.sites?.length) {
      for (const site of dto.sites) {
        ops.push(
          this.prisma.siteMapLayout.upsert({
            where: { siteId: site.siteId },
            update: {
              geometry: site.geometry,
              centroid: site.centroid ?? null,
              label: site.label ?? null,
              rotation: site.rotation ?? null,
              metadata: site.metadata ?? null,
              campgroundId
            },
            create: {
              siteId: site.siteId,
              campgroundId,
              geometry: site.geometry,
              centroid: site.centroid ?? null,
              label: site.label ?? null,
              rotation: site.rotation ?? null,
              metadata: site.metadata ?? null
            }
          })
        );
      }
    }

    if (!ops.length) return this.getMap(campgroundId);
    await this.prisma.$transaction(ops);
    return this.getMap(campgroundId);
  }

  async checkAssignment(campgroundId: string, dto: CheckAssignmentDto) {
    const site = await this.prisma.site.findUnique({ where: { id: dto.siteId } });
    if (!site || site.campgroundId !== campgroundId) {
      throw new NotFoundException("Site not found in this campground");
    }

    const { start, end } = this.parseDates(dto.startDate, dto.endDate);
    const reasons = this.evaluateSiteFit(site, dto);
    const conflictsMap = await this.buildConflictsMap(campgroundId, [site.id], start, end);
    const conflicts = conflictsMap[site.id] ?? [];
    if (conflicts.length) reasons.push("status_blocked");

    return {
      ok: reasons.length === 0,
      reasons: Array.from(new Set(reasons)),
      conflicts
    };
  }

  async previewAssignments(campgroundId: string, dto: PreviewAssignmentsDto) {
    const { start, end } = this.parseDates(dto.startDate, dto.endDate);
    const sites = await this.prisma.site.findMany({
      where: {
        campgroundId,
        ...(dto.siteIds?.length ? { id: { in: dto.siteIds } } : {}),
        isActive: true
      }
    });

    if (!sites.length) {
      return { eligible: [], ineligible: [] };
    }

    const conflictsMap = await this.buildConflictsMap(campgroundId, sites.map(s => s.id), start, end);
    const eligible: any[] = [];
    const ineligible: any[] = [];

    for (const site of sites) {
      const reasons = this.evaluateSiteFit(site, dto);
      const conflicts = conflictsMap[site.id] ?? [];
      if (conflicts.length) reasons.push("status_blocked");

      const payload = {
        siteId: site.id,
        reasons: Array.from(new Set(reasons)),
        conflicts
      };

      if (payload.reasons.length === 0) {
        eligible.push(payload);
      } else {
        ineligible.push(payload);
      }
    }

    return { eligible, ineligible };
  }

  private evaluateSiteFit(site: any, dto: CheckAssignmentDto | PreviewAssignmentsDto): AssignmentReason[] {
    const reasons: AssignmentReason[] = [];
    const rig = dto.rig ?? {};

    if (rig.length && site.rigMaxLength && rig.length > site.rigMaxLength) reasons.push("rig_too_long");
    if (rig.width && site.rigMaxWidth && rig.width > site.rigMaxWidth) reasons.push("rig_too_wide");
    if (rig.height && site.rigMaxHeight && rig.height > site.rigMaxHeight) reasons.push("rig_too_tall");

    if (dto.needsADA && !site.accessible) reasons.push("ada_required");
    if (dto.partySize && site.maxOccupancy && dto.partySize > site.maxOccupancy) reasons.push("party_too_large");

    const requiredAmenities = dto.requiredAmenities ?? [];
    if (requiredAmenities.length) {
      const available = ((site.amenityTags?.length ? site.amenityTags : site.tags) ?? []).map((a: string) => a.toLowerCase());
      const missing = requiredAmenities.filter(a => !available.includes(a.toLowerCase()));
      if (missing.length) reasons.push("missing_amenities");
    }

    return reasons;
  }

  private async buildConflictsMap(
    campgroundId: string,
    siteIds: string[] | undefined,
    start: Date,
    end: Date
  ): Promise<Record<string, Conflict[]>> {
    const map: Record<string, Conflict[]> = {};
    const siteFilter = siteIds?.length ? { in: siteIds } : undefined;

    const [reservations, holds, maintenance, blackouts] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          campgroundId,
          ...(siteFilter ? { siteId: siteFilter } : {}),
          status: { not: ReservationStatus.cancelled },
          arrivalDate: { lt: end },
          departureDate: { gt: start }
        },
        select: { id: true, siteId: true, arrivalDate: true, departureDate: true, status: true }
      }),
      this.prisma.siteHold.findMany({
        where: {
          campgroundId,
          ...(siteFilter ? { siteId: siteFilter } : {}),
          status: "active",
          arrivalDate: { lt: end },
          departureDate: { gt: start },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        select: { id: true, siteId: true, arrivalDate: true, departureDate: true, status: true }
      }),
      this.prisma.maintenanceTicket.findMany({
        where: {
          campgroundId,
          ...(siteFilter ? { siteId: siteFilter } : {}),
          status: { in: ["open", "in_progress"] },
          OR: [{ outOfOrder: true }, { isBlocking: true }, { outOfOrderUntil: { gt: start } }]
        },
        select: { id: true, siteId: true, outOfOrderUntil: true, status: true, outOfOrder: true, isBlocking: true }
      }),
      this.prisma.blackoutDate.findMany({
        where: {
          campgroundId,
          startDate: { lt: end },
          endDate: { gt: start },
          ...(siteFilter ? { OR: [{ siteId: null }, { siteId: siteFilter }] } : {})
        },
        select: { id: true, siteId: true, startDate: true, endDate: true, reason: true }
      })
    ]);

    for (const r of reservations) {
      if (!r.siteId) continue;
      map[r.siteId] = map[r.siteId] || [];
      map[r.siteId].push({ type: "reservation", id: r.id, start: r.arrivalDate, end: r.departureDate, status: r.status });
    }

    for (const h of holds) {
      map[h.siteId] = map[h.siteId] || [];
      map[h.siteId].push({ type: "hold", id: h.id, start: h.arrivalDate, end: h.departureDate, status: h.status });
    }

    for (const m of maintenance) {
      if (!m.siteId) continue;
      map[m.siteId] = map[m.siteId] || [];
      map[m.siteId].push({
        type: "maintenance",
        id: m.id,
        start: start,
        end: m.outOfOrderUntil ?? end,
        status: m.status,
        reason: m.outOfOrder ? "out_of_order" : m.isBlocking ? "blocking" : null
      });
    }

    for (const b of blackouts) {
      const targets = b.siteId ? [b.siteId] : siteIds ?? [];
      for (const target of targets) {
        map[target] = map[target] || [];
        map[target].push({ type: "blackout", id: b.id, start: b.startDate, end: b.endDate, reason: b.reason ?? null });
      }
    }

    return map;
  }

  private parseDates(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      throw new BadRequestException("Invalid date range");
    }
    if (end <= start) {
      throw new BadRequestException("End date must be after start date");
    }
    return { start, end };
  }
}
