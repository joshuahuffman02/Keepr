import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

@Injectable()
export class GuestEquipmentService {
  constructor(private prisma: PrismaService) {}

  async create(
    guestId: string,
    data: {
      type: string;
      make?: string;
      model?: string;
      length?: number;
      plateNumber?: string;
      plateState?: string;
    },
  ) {
    return this.prisma.guestEquipment.create({
      data: {
        id: randomUUID(),
        guestId,
        ...data,
      },
    });
  }

  async findAll(guestId: string) {
    return this.prisma.guestEquipment.findMany({
      where: { guestId },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(
    id: string,
    data: {
      type?: string;
      make?: string;
      model?: string;
      length?: number;
      plateNumber?: string;
      plateState?: string;
    },
  ) {
    return this.prisma.guestEquipment.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.guestEquipment.delete({
      where: { id },
    });
  }
}
