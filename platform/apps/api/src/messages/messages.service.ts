import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
    constructor(private readonly prisma: PrismaService) { }

    async listByReservation(reservationId: string) {
        return this.prisma.message.findMany({
            where: { reservationId },
            orderBy: { createdAt: 'asc' },
            include: {
                guest: {
                    select: {
                        id: true,
                        primaryFirstName: true,
                        primaryLastName: true,
                    },
                },
            },
        });
    }

    async create(reservationId: string, data: CreateMessageDto) {
        // First get the reservation to get campgroundId
        const reservation = await this.prisma.reservation.findUniqueOrThrow({
            where: { id: reservationId },
            select: { campgroundId: true, guestId: true },
        });

        return this.prisma.message.create({
            data: {
                campgroundId: reservation.campgroundId,
                reservationId,
                guestId: data.guestId,
                senderType: data.senderType,
                content: data.content,
            },
            include: {
                guest: {
                    select: {
                        id: true,
                        primaryFirstName: true,
                        primaryLastName: true,
                    },
                },
            },
        });
    }

    async markAsRead(messageId: string) {
        return this.prisma.message.update({
            where: { id: messageId },
            data: { readAt: new Date() },
        });
    }

    async markAllAsReadForReservation(reservationId: string, senderType: 'guest' | 'staff') {
        // Mark messages from the opposite sender as read
        const oppositeType = senderType === 'guest' ? 'staff' : 'guest';
        return this.prisma.message.updateMany({
            where: {
                reservationId,
                senderType: oppositeType,
                readAt: null,
            },
            data: { readAt: new Date() },
        });
    }

    async getUnreadCount(campgroundId: string) {
        // Count unread messages from guests (for staff to see)
        const count = await this.prisma.message.count({
            where: {
                campgroundId,
                senderType: 'guest',
                readAt: null,
            },
        });
        return { unreadCount: count };
    }

    async getUnreadCountForReservation(reservationId: string) {
        const count = await this.prisma.message.count({
            where: {
                reservationId,
                senderType: 'guest',
                readAt: null,
            },
        });
        return { unreadCount: count };
    }

    /**
     * Get all conversations for a campground in a single efficient query.
     * Returns reservations that have messages, with all messages included.
     * Optimized: fetches messages and reservations separately to avoid N+1 joins.
     */
    async getConversations(campgroundId: string) {
        // Step 1: Get all messages with minimal data (no reservation join per message)
        const messages = await this.prisma.message.findMany({
            where: { campgroundId },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                content: true,
                senderType: true,
                createdAt: true,
                readAt: true,
                campgroundId: true,
                reservationId: true,
                guestId: true,
                guest: {
                    select: {
                        id: true,
                        primaryFirstName: true,
                        primaryLastName: true,
                    },
                },
            },
        });

        // Step 2: Get unique reservation IDs
        const reservationIds = [...new Set(messages.map(m => m.reservationId))];

        // Step 3: Fetch all reservation details in one query
        const reservations = await this.prisma.reservation.findMany({
            where: { id: { in: reservationIds } },
            select: {
                id: true,
                status: true,
                arrivalDate: true,
                departureDate: true,
                adults: true,
                children: true,
                pets: true,
                totalAmountCents: true,
                notes: true,
                guest: {
                    select: {
                        id: true,
                        primaryFirstName: true,
                        primaryLastName: true,
                        email: true,
                        phone: true,
                    },
                },
                site: {
                    select: {
                        id: true,
                        name: true,
                        siteNumber: true,
                        siteType: true,
                    },
                },
            },
        });

        // Create a map for quick reservation lookup
        const reservationMap = new Map(reservations.map(r => [r.id, r]));

        // Group messages by reservation
        const conversationsMap = new Map<string, {
            reservationId: string;
            guestName: string;
            guestEmail: string | null;
            guestPhone: string | null;
            guestId: string | null;
            siteName: string;
            siteType: string | null;
            status: string;
            arrivalDate: Date | null;
            departureDate: Date | null;
            adults: number | null;
            children: number | null;
            pets: number | null;
            totalAmountCents: number | null;
            notes: string | null;
            messages: typeof messages;
            unreadCount: number;
            lastMessage: typeof messages[0] | null;
        }>();

        for (const msg of messages) {
            const resId = msg.reservationId;
            if (!conversationsMap.has(resId)) {
                const res = reservationMap.get(resId);
                const guestName = res?.guest
                    ? `${res.guest.primaryFirstName || ''} ${res.guest.primaryLastName || ''}`.trim() || 'Unknown Guest'
                    : 'Unknown Guest';
                const siteName = res?.site?.name || res?.site?.siteNumber || 'Unknown Site';

                conversationsMap.set(resId, {
                    reservationId: resId,
                    guestName,
                    guestEmail: res?.guest?.email || null,
                    guestPhone: res?.guest?.phone || null,
                    guestId: res?.guest?.id || null,
                    siteName,
                    siteType: res?.site?.siteType || null,
                    status: res?.status || 'unknown',
                    arrivalDate: res?.arrivalDate || null,
                    departureDate: res?.departureDate || null,
                    adults: res?.adults || null,
                    children: res?.children || null,
                    pets: res?.pets || null,
                    totalAmountCents: res?.totalAmountCents || null,
                    notes: res?.notes || null,
                    messages: [],
                    unreadCount: 0,
                    lastMessage: null,
                });
            }

            const conv = conversationsMap.get(resId)!;
            conv.messages.push(msg);
            conv.lastMessage = msg;

            if (msg.senderType === 'guest' && !msg.readAt) {
                conv.unreadCount++;
            }
        }

        // Convert to array and sort by last message time (most recent first)
        const conversations = Array.from(conversationsMap.values()).sort((a, b) => {
            const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });

        return conversations;
    }
}
