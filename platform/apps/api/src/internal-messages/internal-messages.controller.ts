import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { InternalMessagesService } from './internal-messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('internal-messages')
@UseGuards(JwtAuthGuard)
export class InternalMessagesController {
    constructor(private readonly internalMessagesService: InternalMessagesService) { }

    @Post()
    create(@Request() req: Request, @Body() body: { content: string; conversationId: string }) {
        return this.internalMessagesService.create(body.content, req.user.id, body.conversationId);
    }

    @Get()
    findAll(@Query('conversationId') conversationId: string, @Query('limit') limit?: string) {
        return this.internalMessagesService.findAll(conversationId, limit ? parseInt(limit, 10) : undefined);
    }
}
