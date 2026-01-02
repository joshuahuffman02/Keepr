import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUpsellDto } from "./dto/create-upsell.dto";
import { UpdateUpsellDto } from "./dto/update-upsell.dto";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class UpsellsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  list(campgroundId: string) {
    return this.prisma.upsellItem.findMany({
      where: { campgroundId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }]
    });
  }

  async create(campgroundId: string, dto: CreateUpsellDto, actorId?: string | null) {
    const item = await this.prisma.upsellItem.create({
      data: {
        ...dto,
        campgroundId,
        siteClassId: dto.siteClassId ?? null,
        description: dto.description ?? null,
        taxCode: dto.taxCode ?? null,
        inventoryTracking: dto.inventoryTracking ?? false
      }
    });

    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "upsell_item.create",
      entity: "UpsellItem",
      entityId: item.id,
      before: null,
      after: item
    });

    return item;
  }

  async update(campgroundId: string, id: string, dto: UpdateUpsellDto, actorId?: string | null) {
    const existing = await this.prisma.upsellItem.findFirst({ where: { id, campgroundId } });
    if (!existing) throw new NotFoundException("Upsell item not found");
    const { campgroundId: _campgroundId, siteClassId, description, taxCode, inventoryTracking, ...rest } =
      dto as UpdateUpsellDto & { campgroundId?: string };
    const updated = await this.prisma.upsellItem.update({
      where: { id },
      data: {
        ...rest,
        siteClassId: siteClassId === undefined ? undefined : siteClassId ?? null,
        description: description === undefined ? undefined : description ?? null,
        taxCode: taxCode === undefined ? undefined : taxCode ?? null,
        inventoryTracking: inventoryTracking === undefined ? undefined : inventoryTracking
      }
    });

    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: actorId ?? null,
      action: "upsell_item.update",
      entity: "UpsellItem",
      entityId: id,
      before: existing,
      after: updated
    });

    return updated;
  }

  async remove(campgroundId: string, id: string, actorId?: string | null) {
    const existing = await this.prisma.upsellItem.findFirst({ where: { id, campgroundId } });
    if (!existing) throw new NotFoundException("Upsell item not found");
    await this.prisma.upsellItem.delete({ where: { id } });

    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: actorId ?? null,
      action: "upsell_item.delete",
      entity: "UpsellItem",
      entityId: id,
      before: existing,
      after: null
    });

    return existing;
  }
}
