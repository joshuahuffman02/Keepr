import { Injectable, NotFoundException } from "@nestjs/common";
import { FeatureFlagScope, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

type FeatureFlagCreateInput = Omit<Prisma.FeatureFlagCreateInput, "id" | "updatedAt">;

@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  private isFlagEnabled(
    flag: Pick<
      Prisma.FeatureFlagGetPayload<{ select: { enabled: true; scope: true; campgrounds: true } }>,
      "enabled" | "scope" | "campgrounds"
    >,
    campgroundId?: string,
  ) {
    if (!flag.enabled) return false;
    if (flag.scope === FeatureFlagScope.global) return true;
    if (flag.scope === FeatureFlagScope.campground && campgroundId) {
      return flag.campgrounds.includes(campgroundId);
    }
    return false;
  }

  async findAll() {
    return this.prisma.featureFlag.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException("Feature flag not found");
    return flag;
  }

  async findByKey(key: string) {
    return this.prisma.featureFlag.findUnique({ where: { key } });
  }

  async listEvaluated(campgroundId?: string) {
    const flags = await this.prisma.featureFlag.findMany({
      select: {
        key: true,
        enabled: true,
        scope: true,
        campgrounds: true,
      },
      orderBy: { name: "asc" },
    });
    return flags.map((flag) => ({
      key: flag.key,
      enabled: this.isFlagEnabled(flag, campgroundId),
    }));
  }

  async isEnabledOrDefault(
    key: string,
    campgroundId?: string,
    defaultEnabled: boolean = true,
  ): Promise<boolean> {
    const flag = await this.findByKey(key);
    if (!flag) return defaultEnabled;
    return this.isFlagEnabled(flag, campgroundId);
  }

  async create(data: FeatureFlagCreateInput) {
    return this.prisma.featureFlag.create({
      data: {
        id: randomUUID(),
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async update(id: string, data: Prisma.FeatureFlagUpdateInput) {
    return this.prisma.featureFlag.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async toggle(id: string) {
    const flag = await this.findOne(id);
    return this.prisma.featureFlag.update({
      where: { id },
      data: { enabled: !flag.enabled },
    });
  }

  async delete(id: string) {
    return this.prisma.featureFlag.delete({ where: { id } });
  }

  async isEnabled(key: string, campgroundId?: string): Promise<boolean> {
    const flag = await this.findByKey(key);
    if (!flag) return false;
    return this.isFlagEnabled(flag, campgroundId);
  }
}
