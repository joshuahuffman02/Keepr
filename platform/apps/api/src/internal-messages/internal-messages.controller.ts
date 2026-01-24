import { Controller, Get, Post, Body, Query, UseGuards, Req } from "@nestjs/common";
import { InternalMessagesService } from "./internal-messages.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller("internal-messages")
@UseGuards(JwtAuthGuard)
export class InternalMessagesController {
  constructor(private readonly internalMessagesService: InternalMessagesService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: { content: string; conversationId: string },
  ) {
    return this.internalMessagesService.create(body.content, req.user.id, body.conversationId);
  }

  @Get()
  findAll(@Query("conversationId") conversationId: string, @Query("limit") limit?: string) {
    return this.internalMessagesService.findAll(
      conversationId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
