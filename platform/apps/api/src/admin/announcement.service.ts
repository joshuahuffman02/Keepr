import { Injectable, NotFoundException } from "@nestjs/common";
import { AnnouncementStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

type AnnouncementCreateInput = Omit<Prisma.AnnouncementCreateInput, "id" | "updatedAt">;

@Injectable()
export class AnnouncementService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: AnnouncementStatus) {
    return this.prisma.announcement.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException("Announcement not found");
    return announcement;
  }

  async create(data: AnnouncementCreateInput) {
    return this.prisma.announcement.create({
      data: {
        id: randomUUID(),
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async update(id: string, data: Prisma.AnnouncementUpdateInput) {
    return this.prisma.announcement.update({
      where: { id },
      data,
    });
  }

  async send(id: string) {
    return this.prisma.announcement.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }
}
