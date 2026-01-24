import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

@Injectable()
export class InternalConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createChannel(name: string, campgroundId: string, participantIds: string[]) {
    return this.prisma.internalConversation.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        name,
        type: "channel",
        campgroundId,
        InternalConversationParticipant: {
          create: participantIds.map((id) => ({ id: randomUUID(), userId: id })),
        },
      },
      include: {
        InternalConversationParticipant: {
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
        },
      },
    });
  }

  async createDM(campgroundId: string, participantIds: string[]) {
    return this.prisma.internalConversation.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        type: "dm",
        campgroundId,
        InternalConversationParticipant: {
          create: participantIds.map((id) => ({ id: randomUUID(), userId: id })),
        },
      },
      include: {
        InternalConversationParticipant: {
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
        },
      },
    });
  }

  async findAll(userId: string, campgroundId: string) {
    return this.prisma.internalConversation.findMany({
      where: {
        campgroundId,
        InternalConversationParticipant: {
          some: {
            userId,
          },
        },
      },
      include: {
        InternalConversationParticipant: {
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
        },
        InternalMessage: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }
}
