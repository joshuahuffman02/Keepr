import { Body, Controller, Get, Param, Post, UseGuards, Req, Patch } from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { CreateMessageDto, SenderType } from "./dto/create-message.dto";
import { AuthGuard } from "@nestjs/passport";
import type { Request as ExpressRequest } from "express";

type GuestRequest = ExpressRequest & { user: { id: string } };

@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // Get messages for a reservation (staff access)
  @Get("reservations/:id/messages")
  async listMessages(@Param("id") reservationId: string) {
    return this.messagesService.listByReservation(reservationId);
  }

  // Send message from staff
  @Post("reservations/:id/messages")
  async createMessage(@Param("id") reservationId: string, @Body() body: CreateMessageDto) {
    return this.messagesService.create(reservationId, body);
  }

  // Mark messages as read
  @Patch("reservations/:id/messages/read")
  async markAsRead(
    @Param("id") reservationId: string,
    @Body("senderType") senderType: "guest" | "staff",
  ) {
    return this.messagesService.markAllAsReadForReservation(reservationId, senderType);
  }

  // Get unread count for campground (for sidebar badge)
  @Get("campgrounds/:campgroundId/messages/unread-count")
  async getUnreadCount(@Param("campgroundId") campgroundId: string) {
    return this.messagesService.getUnreadCount(campgroundId);
  }

  // Get all conversations for a campground (batch endpoint for messages page)
  @Get("campgrounds/:campgroundId/conversations")
  async getConversations(@Param("campgroundId") campgroundId: string) {
    return this.messagesService.getConversations(campgroundId);
  }

  // Guest portal endpoints (protected by guest-jwt)
  @Get("portal/reservations/:id/messages")
  @UseGuards(AuthGuard("guest-jwt"))
  async listGuestMessages(@Param("id") reservationId: string) {
    // Verify the guest owns this reservation
    // For now, we trust the guard, but you could add additional checks
    return this.messagesService.listByReservation(reservationId);
  }

  @Post("portal/reservations/:id/messages")
  @UseGuards(AuthGuard("guest-jwt"))
  async createGuestMessage(
    @Param("id") reservationId: string,
    @Body() body: Omit<CreateMessageDto, "senderType" | "guestId">,
    @Req() req: GuestRequest,
  ) {
    // Use the guest ID from the JWT token
    const guestId = req.user.id;
    const payload: CreateMessageDto = {
      ...body,
      guestId,
      senderType: SenderType.guest,
    };
    return this.messagesService.create(reservationId, payload);
  }
}
