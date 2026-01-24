import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";
import { CheckAssignmentDto } from "./dto/check-assignment.dto";
import { PreviewAssignmentsDto } from "./dto/preview-assignments.dto";
import { UpsertMapDto } from "./dto/upsert-map.dto";
import { UpsertMapAssignmentsDto } from "./dto/upsert-map-assignments.dto";
import { UpsertMapShapesDto } from "./dto/upsert-map-shapes.dto";

export type ConflictType = "reservation" | "hold" | "maintenance" | "blackout";

export interface Conflict {
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

type SiteFit = {
  rigMaxLength?: number | null;
  rigMaxWidth?: number | null;
  rigMaxHeight?: number | null;
  accessible?: boolean | null;
  maxOccupancy?: number | null;
  amenityTags?: string[] | null;
  tags?: string[] | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const toJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return toJsonValue(value) ?? Prisma.JsonNull;
};

@Injectable()
export class SiteMapService {
  constructor(private readonly prisma: PrismaService) {}

  async getMap(campgroundId: string, startDate?: string, endDate?: string) {
    await this.ensureShapeAssignments(campgroundId);

    const [assignments, shapes, config] = await this.prisma.$transaction([
      this.prisma.siteMapAssignment.findMany({
        where: { campgroundId },
        include: { Site: true, SiteMapShape: true },
      }),
      this.prisma.siteMapShape.findMany({ where: { campgroundId } }),
      this.prisma.campgroundMapConfig.findUnique({ where: { campgroundId } }),
    ]);

    let conflictsBySite: Record<string, Conflict[]> = {};
    if (startDate && endDate && assignments.length) {
      const { start, end } = this.parseDates(startDate, endDate);
      conflictsBySite = await this.buildConflictsMap(
        campgroundId,
        assignments.map((a) => a.siteId),
        start,
        end,
      );
    }

    const assignedByShape = new Map(assignments.map((a) => [a.shapeId, a.siteId]));

    return {
      config: config ?? null,
      sites: assignments.map((assignment) => ({
        siteId: assignment.siteId,
        shapeId: assignment.shapeId,
        name: assignment.Site.name,
        siteNumber: assignment.Site.siteNumber,
        geometry: assignment.SiteMapShape.geometry,
        centroid: assignment.SiteMapShape.centroid,
        label: assignment.label ?? assignment.Site.mapLabel ?? assignment.Site.name,
        rotation: assignment.rotation,
        ada: assignment.Site.accessible,
        amenityTags:
          (assignment.Site.amenityTags?.length
            ? assignment.Site.amenityTags
            : assignment.Site.tags) ?? [],
        rigConstraints: {
          length: assignment.Site.rigMaxLength ?? null,
          width: assignment.Site.rigMaxWidth ?? null,
          height: assignment.Site.rigMaxHeight ?? null,
          pullThrough: assignment.Site.pullThrough ?? false,
        },
        hookups: {
          power: assignment.Site.hookupsPower,
          powerAmps: assignment.Site.powerAmps,
          water: assignment.Site.hookupsWater,
          sewer: assignment.Site.hookupsSewer,
        },
        status: assignment.Site.status ?? null,
        conflicts: conflictsBySite[assignment.siteId] ?? [],
      })),
      shapes: shapes.map((shape) => ({
        id: shape.id,
        name: shape.name,
        geometry: shape.geometry,
        centroid: shape.centroid,
        metadata: shape.metadata,
        assignedSiteId: assignedByShape.get(shape.id) ?? null,
      })),
    };
  }

  async upsertMap(campgroundId: string, dto: UpsertMapDto) {
    await this.ensureShapeAssignments(campgroundId);
    const siteIds = dto.sites?.map((s) => s.siteId) ?? [];

    if (siteIds.length) {
      const count = await this.prisma.site.count({ where: { id: { in: siteIds }, campgroundId } });
      if (count !== siteIds.length) {
        throw new BadRequestException("One or more sites do not belong to this campground");
      }
    }

    if (!dto.config && !dto.sites?.length) return this.getMap(campgroundId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.config) {
        await tx.campgroundMapConfig.upsert({
          where: { campgroundId },
          update: {
            bounds: toJsonInput(dto.config.bounds),
            defaultCenter: toJsonInput(dto.config.defaultCenter),
            defaultZoom: dto.config.defaultZoom ?? null,
            layers: toJsonInput(dto.config.layers),
            legend: toJsonInput(dto.config.legend),
            updatedAt: new Date(),
          },
          create: {
            campgroundId,
            bounds: toJsonInput(dto.config.bounds),
            defaultCenter: toJsonInput(dto.config.defaultCenter),
            defaultZoom: dto.config.defaultZoom ?? null,
            layers: toJsonInput(dto.config.layers),
            legend: toJsonInput(dto.config.legend),
            updatedAt: new Date(),
          },
        });
      }

      if (dto.sites?.length) {
        const assignments = await tx.siteMapAssignment.findMany({
          where: { siteId: { in: siteIds } },
        });
        const assignmentBySite = new Map(assignments.map((a) => [a.siteId, a]));

        for (const site of dto.sites) {
          const assignment = assignmentBySite.get(site.siteId);
          if (assignment) {
            await tx.siteMapShape.update({
              where: { id: assignment.shapeId },
              data: {
                geometry: toJsonValue(site.geometry) ?? {},
                centroid: toJsonInput(site.centroid),
                updatedAt: new Date(),
              },
            });
            const assignmentUpdate: Prisma.SiteMapAssignmentUpdateInput = {};
            if (site.label !== undefined) assignmentUpdate.label = site.label ?? null;
            if (site.rotation !== undefined) assignmentUpdate.rotation = site.rotation ?? null;
            if (site.metadata !== undefined) assignmentUpdate.metadata = toJsonInput(site.metadata);
            if (Object.keys(assignmentUpdate).length) {
              await tx.siteMapAssignment.update({
                where: { id: assignment.id },
                data: { ...assignmentUpdate, updatedAt: new Date() },
              });
            }
          } else {
            const shape = await tx.siteMapShape.create({
              data: {
                id: randomUUID(),
                campgroundId,
                name: site.label ?? null,
                geometry: toJsonValue(site.geometry) ?? {},
                centroid: toJsonInput(site.centroid),
                updatedAt: new Date(),
              },
            });
            await tx.siteMapAssignment.create({
              data: {
                id: randomUUID(),
                campgroundId,
                siteId: site.siteId,
                shapeId: shape.id,
                label: site.label ?? null,
                rotation: site.rotation ?? null,
                metadata: toJsonInput(site.metadata),
                updatedAt: new Date(),
              },
            });
          }
        }
      }
    });

    return this.getMap(campgroundId);
  }

  async upsertShapes(campgroundId: string, dto: UpsertMapShapesDto) {
    if (!dto.shapes?.length) return this.getMap(campgroundId);
    const ids = dto.shapes
      .map((shape) => shape.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length) {
      const count = await this.prisma.siteMapShape.count({
        where: { id: { in: ids }, campgroundId },
      });
      if (count !== ids.length) {
        throw new BadRequestException("One or more shapes do not belong to this campground");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const shape of dto.shapes) {
        if (shape.id) {
          await tx.siteMapShape.update({
            where: { id: shape.id },
            data: {
              name: shape.name ?? null,
              geometry: toJsonValue(shape.geometry) ?? {},
              centroid: toJsonInput(shape.centroid),
              metadata: toJsonInput(shape.metadata),
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.siteMapShape.create({
            data: {
              id: randomUUID(),
              campgroundId,
              name: shape.name ?? null,
              geometry: toJsonValue(shape.geometry) ?? {},
              centroid: toJsonInput(shape.centroid),
              metadata: toJsonInput(shape.metadata),
              updatedAt: new Date(),
            },
          });
        }
      }
    });

    return this.getMap(campgroundId);
  }

  async deleteShape(campgroundId: string, shapeId: string) {
    await this.prisma.siteMapShape.deleteMany({ where: { id: shapeId, campgroundId } });
    return this.getMap(campgroundId);
  }

  async upsertAssignments(campgroundId: string, dto: UpsertMapAssignmentsDto) {
    if (!dto.assignments?.length) return this.getMap(campgroundId);

    const siteIds = dto.assignments.map((assignment) => assignment.siteId);
    const shapeIds = dto.assignments.map((assignment) => assignment.shapeId);

    const [siteCount, shapeCount] = await this.prisma.$transaction([
      this.prisma.site.count({ where: { id: { in: siteIds }, campgroundId } }),
      this.prisma.siteMapShape.count({ where: { id: { in: shapeIds }, campgroundId } }),
    ]);

    if (siteCount !== siteIds.length) {
      throw new BadRequestException("One or more sites do not belong to this campground");
    }
    if (shapeCount !== shapeIds.length) {
      throw new BadRequestException("One or more shapes do not belong to this campground");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.siteMapAssignment.deleteMany({
        where: {
          campgroundId,
          OR: [{ siteId: { in: siteIds } }, { shapeId: { in: shapeIds } }],
        },
      });

      await tx.siteMapAssignment.createMany({
        data: dto.assignments.map((assignment) => ({
          id: randomUUID(),
          campgroundId,
          siteId: assignment.siteId,
          shapeId: assignment.shapeId,
          label: assignment.label ?? null,
          rotation: assignment.rotation ?? null,
          metadata: toJsonInput(assignment.metadata),
          updatedAt: new Date(),
        })),
      });
    });

    return this.getMap(campgroundId);
  }

  async unassignSite(campgroundId: string, siteId: string) {
    await this.prisma.siteMapAssignment.deleteMany({ where: { campgroundId, siteId } });
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
      conflicts,
    };
  }

  async previewAssignments(campgroundId: string, dto: PreviewAssignmentsDto) {
    const { start, end } = this.parseDates(dto.startDate, dto.endDate);
    const sites = await this.prisma.site.findMany({
      where: {
        campgroundId,
        ...(dto.siteIds?.length ? { id: { in: dto.siteIds } } : {}),
        isActive: true,
      },
    });

    if (!sites.length) {
      return { eligible: [], ineligible: [] };
    }

    const conflictsMap = await this.buildConflictsMap(
      campgroundId,
      sites.map((s) => s.id),
      start,
      end,
    );
    type PreviewResult = { siteId: string; reasons: AssignmentReason[]; conflicts: Conflict[] };
    const eligible: PreviewResult[] = [];
    const ineligible: PreviewResult[] = [];

    for (const site of sites) {
      const reasons = this.evaluateSiteFit(site, dto);
      const conflicts = conflictsMap[site.id] ?? [];
      if (conflicts.length) reasons.push("status_blocked");

      const payload = {
        siteId: site.id,
        reasons: Array.from(new Set(reasons)),
        conflicts,
      };

      if (payload.reasons.length === 0) {
        eligible.push(payload);
      } else {
        ineligible.push(payload);
      }
    }

    return { eligible, ineligible };
  }

  async setBaseImage(campgroundId: string, url: string) {
    const existing = await this.prisma.campgroundMapConfig.findUnique({ where: { campgroundId } });
    const existingLayers = isRecord(existing?.layers) ? existing?.layers : {};
    const layers = toJsonInput({ ...existingLayers, baseImageUrl: url });

    await this.prisma.campgroundMapConfig.upsert({
      where: { campgroundId },
      update: { layers, updatedAt: new Date() },
      create: { campgroundId, layers, updatedAt: new Date() },
    });

    return { url };
  }

  private async ensureShapeAssignments(campgroundId: string) {
    const [assignmentCount, shapeCount] = await this.prisma.$transaction([
      this.prisma.siteMapAssignment.count({ where: { campgroundId } }),
      this.prisma.siteMapShape.count({ where: { campgroundId } }),
    ]);

    if (assignmentCount || shapeCount) return;

    const layouts = await this.prisma.siteMapLayout.findMany({
      where: { campgroundId },
      include: { Site: true },
    });

    if (!layouts.length) return;

    await this.prisma.$transaction(async (tx) => {
      for (const layout of layouts) {
        const shape = await tx.siteMapShape.create({
          data: {
            id: randomUUID(),
            campgroundId,
            name: layout.label ?? layout.Site.mapLabel ?? layout.Site.name ?? null,
            geometry: toJsonValue(layout.geometry) ?? {},
            centroid: toJsonInput(layout.centroid),
            metadata: toJsonInput(layout.metadata),
            updatedAt: new Date(),
          },
        });

        await tx.siteMapAssignment.create({
          data: {
            id: randomUUID(),
            campgroundId,
            siteId: layout.siteId,
            shapeId: shape.id,
            label: layout.label ?? null,
            rotation: layout.rotation ?? null,
            metadata: toJsonInput(layout.metadata),
            updatedAt: new Date(),
          },
        });
      }
    });
  }

  private evaluateSiteFit(
    site: SiteFit,
    dto: CheckAssignmentDto | PreviewAssignmentsDto,
  ): AssignmentReason[] {
    const reasons: AssignmentReason[] = [];
    const rig = dto.rig ?? {};

    if (rig.length && site.rigMaxLength && rig.length > site.rigMaxLength)
      reasons.push("rig_too_long");
    if (rig.width && site.rigMaxWidth && rig.width > site.rigMaxWidth) reasons.push("rig_too_wide");
    if (rig.height && site.rigMaxHeight && rig.height > site.rigMaxHeight)
      reasons.push("rig_too_tall");

    if (dto.needsADA && !site.accessible) reasons.push("ada_required");
    if (dto.partySize && site.maxOccupancy && dto.partySize > site.maxOccupancy)
      reasons.push("party_too_large");

    const requiredAmenities = dto.requiredAmenities ?? [];
    if (requiredAmenities.length) {
      const baseTags = site.amenityTags?.length ? site.amenityTags : site.tags;
      const available = (baseTags ?? []).map((tag) => tag.toLowerCase());
      const missing = requiredAmenities.filter((a) => !available.includes(a.toLowerCase()));
      if (missing.length) reasons.push("missing_amenities");
    }

    return reasons;
  }

  private async buildConflictsMap(
    campgroundId: string,
    siteIds: string[] | undefined,
    start: Date,
    end: Date,
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
          departureDate: { gt: start },
        },
        select: { id: true, siteId: true, arrivalDate: true, departureDate: true, status: true },
      }),
      this.prisma.siteHold.findMany({
        where: {
          campgroundId,
          ...(siteFilter ? { siteId: siteFilter } : {}),
          status: "active",
          arrivalDate: { lt: end },
          departureDate: { gt: start },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true, siteId: true, arrivalDate: true, departureDate: true, status: true },
      }),
      this.prisma.maintenanceTicket.findMany({
        where: {
          campgroundId,
          ...(siteFilter ? { siteId: siteFilter } : {}),
          status: { in: ["open", "in_progress"] },
          OR: [{ outOfOrder: true }, { isBlocking: true }, { outOfOrderUntil: { gt: start } }],
        },
        select: {
          id: true,
          siteId: true,
          outOfOrderUntil: true,
          status: true,
          outOfOrder: true,
          isBlocking: true,
        },
      }),
      this.prisma.blackoutDate.findMany({
        where: {
          campgroundId,
          startDate: { lt: end },
          endDate: { gt: start },
          ...(siteFilter ? { OR: [{ siteId: null }, { siteId: siteFilter }] } : {}),
        },
        select: { id: true, siteId: true, startDate: true, endDate: true, reason: true },
      }),
    ]);

    for (const r of reservations) {
      if (!r.siteId) continue;
      map[r.siteId] = map[r.siteId] || [];
      map[r.siteId].push({
        type: "reservation",
        id: r.id,
        start: r.arrivalDate,
        end: r.departureDate,
        status: r.status,
      });
    }

    for (const h of holds) {
      map[h.siteId] = map[h.siteId] || [];
      map[h.siteId].push({
        type: "hold",
        id: h.id,
        start: h.arrivalDate,
        end: h.departureDate,
        status: h.status,
      });
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
        reason: m.outOfOrder ? "out_of_order" : m.isBlocking ? "blocking" : null,
      });
    }

    for (const b of blackouts) {
      const targets = b.siteId ? [b.siteId] : (siteIds ?? []);
      for (const target of targets) {
        map[target] = map[target] || [];
        map[target].push({
          type: "blackout",
          id: b.id,
          start: b.startDate,
          end: b.endDate,
          reason: b.reason ?? null,
        });
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
