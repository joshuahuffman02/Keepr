import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CheckAssignmentDto } from "./dto/check-assignment.dto";
import { PreviewAssignmentsDto } from "./dto/preview-assignments.dto";
import { UpsertMapDto } from "./dto/upsert-map.dto";
import { UpsertMapAssignmentsDto } from "./dto/upsert-map-assignments.dto";
import { UpsertMapShapesDto } from "./dto/upsert-map-shapes.dto";

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
    await this.ensureShapeAssignments(campgroundId);

    const [assignments, shapes, config] = await this.prisma.$transaction([
      this.prisma.siteMapAssignment.findMany({
        where: { campgroundId },
        include: { Site: true, shape: true }
      }),
      this.prisma.siteMapShape.findMany({ where: { campgroundId } }),
      this.prisma.campgroundMapConfig.findUnique({ where: { campgroundId } })
    ]);

    let conflictsBySite: Record<string, Conflict[]> = {};
    if (startDate && endDate && assignments.length) {
      const { start, end } = this.parseDates(startDate, endDate);
      conflictsBySite = await this.buildConflictsMap(campgroundId, assignments.map(a => a.siteId), start, end);
    }

    const assignedByShape = new Map(assignments.map(a => [a.shapeId, a.siteId]));

    return {
      config: config ?? null,
      sites: assignments.map(assignment => ({
        siteId: assignment.siteId,
        shapeId: assignment.shapeId,
        name: assignment.site.name,
        siteNumber: assignment.site.siteNumber,
        geometry: assignment.shape.geometry,
        centroid: assignment.shape.centroid,
        label: assignment.label ?? assignment.site.mapLabel ?? assignment.site.name,
        rotation: assignment.rotation,
        ada: assignment.site.accessible,
        amenityTags: (assignment.site.amenityTags?.length ? assignment.site.amenityTags : assignment.site.tags) ?? [],
        rigConstraints: {
          length: assignment.site.rigMaxLength ?? null,
          width: assignment.site.rigMaxWidth ?? null,
          height: assignment.site.rigMaxHeight ?? null,
          pullThrough: assignment.site.pullThrough ?? false
        },
        hookups: {
          power: assignment.site.hookupsPower,
          powerAmps: assignment.site.powerAmps,
          water: assignment.site.hookupsWater,
          sewer: assignment.site.hookupsSewer
        },
        status: assignment.site.status ?? null,
        conflicts: conflictsBySite[assignment.siteId] ?? []
      })),
      shapes: shapes.map(shape => ({
        id: shape.id,
        name: shape.name,
        geometry: shape.geometry,
        centroid: shape.centroid,
        metadata: shape.metadata,
        assignedSiteId: assignedByShape.get(shape.id) ?? null
      }))
    };
  }

  async upsertMap(campgroundId: string, dto: UpsertMapDto) {
    await this.ensureShapeAssignments(campgroundId);
    const siteIds = dto.sites?.map(s => s.siteId) ?? [];

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
        });
      }

      if (dto.sites?.length) {
        const assignments = await tx.siteMapAssignment.findMany({
          where: { siteId: { in: siteIds } }
        });
        const assignmentBySite = new Map(assignments.map(a => [a.siteId, a]));

        for (const site of dto.sites) {
          const assignment = assignmentBySite.get(site.siteId);
          if (assignment) {
            await tx.siteMapShape.update({
              where: { id: assignment.shapeId },
              data: {
                geometry: site.geometry,
                centroid: site.centroid ?? null
              }
            });
            const assignmentUpdate: Prisma.SiteMapAssignmentUpdateInput = {};
            if (site.label !== undefined) assignmentUpdate.label = site.label ?? null;
            if (site.rotation !== undefined) assignmentUpdate.rotation = site.rotation ?? null;
            if (site.metadata !== undefined) assignmentUpdate.metadata = site.metadata ?? null;
            if (Object.keys(assignmentUpdate).length) {
              await tx.siteMapAssignment.update({
                where: { id: assignment.id },
                data: assignmentUpdate
              });
            }
          } else {
            const shape = await tx.siteMapShape.create({
              data: {
                campgroundId,
                name: site.label ?? null,
                geometry: site.geometry,
                centroid: site.centroid ?? null
              }
            });
            await tx.siteMapAssignment.create({
              data: {
                campgroundId,
                siteId: site.siteId,
                shapeId: shape.id,
                label: site.label ?? null,
                rotation: site.rotation ?? null,
                metadata: site.metadata ?? null
              }
            });
          }
        }
      }
    });

    return this.getMap(campgroundId);
  }

  async upsertShapes(campgroundId: string, dto: UpsertMapShapesDto) {
    if (!dto.shapes?.length) return this.getMap(campgroundId);
    const ids = dto.shapes.map(shape => shape.id).filter(Boolean) as string[];
    if (ids.length) {
      const count = await this.prisma.siteMapShape.count({ where: { id: { in: ids }, campgroundId } });
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
              geometry: shape.geometry,
              centroid: shape.centroid ?? null,
              metadata: shape.metadata ?? null
            }
          });
        } else {
          await tx.siteMapShape.create({
            data: {
              campgroundId,
              name: shape.name ?? null,
              geometry: shape.geometry,
              centroid: shape.centroid ?? null,
              metadata: shape.metadata ?? null
            }
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
      this.prisma.siteMapShape.count({ where: { id: { in: shapeIds }, campgroundId } })
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
          OR: [
            { siteId: { in: siteIds } },
            { shapeId: { in: shapeIds } }
          ]
        }
      });

      await tx.siteMapAssignment.createMany({
        data: dto.assignments.map((assignment) => ({
          campgroundId,
          siteId: assignment.siteId,
          shapeId: assignment.shapeId,
          label: assignment.label ?? null,
          rotation: assignment.rotation ?? null,
          metadata: assignment.metadata ?? null
        }))
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

  async setBaseImage(campgroundId: string, url: string) {
    const existing = await this.prisma.campgroundMapConfig.findUnique({ where: { campgroundId } });
    const existingLayers = existing?.layers && typeof existing.layers === "object" ? existing.layers : {};
    const layers = { ...(existingLayers as Record<string, any>), baseImageUrl: url };

    await this.prisma.campgroundMapConfig.upsert({
      where: { campgroundId },
      update: { layers },
      create: { campgroundId, layers }
    });

    return { url };
  }

  private async ensureShapeAssignments(campgroundId: string) {
    const [assignmentCount, shapeCount] = await this.prisma.$transaction([
      this.prisma.siteMapAssignment.count({ where: { campgroundId } }),
      this.prisma.siteMapShape.count({ where: { campgroundId } })
    ]);

    if (assignmentCount || shapeCount) return;

    const layouts = await this.prisma.siteMapLayout.findMany({
      where: { campgroundId },
      include: { Site: true }
    });

    if (!layouts.length) return;

    await this.prisma.$transaction(async (tx) => {
      for (const layout of layouts) {
        const shape = await tx.siteMapShape.create({
          data: {
            campgroundId,
            name: layout.label ?? layout.site.mapLabel ?? layout.site.name ?? null,
            geometry: layout.geometry,
            centroid: layout.centroid ?? null,
            metadata: layout.metadata ?? null
          }
        });

        await tx.siteMapAssignment.create({
          data: {
            campgroundId,
            siteId: layout.siteId,
            shapeId: shape.id,
            label: layout.label ?? null,
            rotation: layout.rotation ?? null,
            metadata: layout.metadata ?? null
          }
        });
      }
    });
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
