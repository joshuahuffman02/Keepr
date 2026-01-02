import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSiteClassDto } from "./dto/create-site-class.dto";
import { SiteType } from "@prisma/client";

@Injectable()
export class SiteClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(campgroundId: string, id: string) {
    const siteClass = await this.prisma.siteClass.findFirst({
      where: { id, campgroundId },
      include: { campground: true }
    });
    if (!siteClass) {
      throw new NotFoundException("Site class not found");
    }
    return siteClass;
  }

  listByCampground(campgroundId: string) {
    return this.prisma.siteClass.findMany({ where: { campgroundId }, orderBy: { name: "asc" } });
  }

  create(data: CreateSiteClassDto) {
    return this.prisma.siteClass.create({ data: { ...data, siteType: data.siteType as SiteType } });
  }

  async update(campgroundId: string, id: string, data: Partial<CreateSiteClassDto>) {
    await this.findOne(campgroundId, id);
    const { campgroundId: _campgroundId, siteType, extraAdultFee, extraChildFee, ...rest } = data;
    return this.prisma.siteClass.update({
      where: { id },
      data: {
        ...rest,
        ...(siteType ? { siteType: siteType as SiteType } : {}),
        // Map frontend field names to Prisma field names
        ...(extraAdultFee !== undefined ? { extraAdultFeeCents: extraAdultFee } : {}),
        ...(extraChildFee !== undefined ? { extraChildFeeCents: extraChildFee } : {}),
      }
    });
  }

  async remove(campgroundId: string, id: string) {
    await this.findOne(campgroundId, id);
    return this.prisma.siteClass.delete({ where: { id } });
  }
}
