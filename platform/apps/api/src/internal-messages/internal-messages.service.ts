import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

@Injectable()
export class InternalMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(content: string, senderId: string, conversationId: string) {
    return this.prisma.internalMessage.create({
      data: {
        id: randomUUID(),
        content,
        senderId,
        conversationId,
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(conversationId: string, limit: number = 50) {
    // Get the most recent N messages, then reverse so oldest is first for chat display
    const messages = await this.prisma.internalMessage.findMany({
      where: { conversationId },
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        content: true,
        senderId: true,
        createdAt: true,
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    // Reverse so oldest message is first (for chat UI)
    return messages.reverse();
  }
}
