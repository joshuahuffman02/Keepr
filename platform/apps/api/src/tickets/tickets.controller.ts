import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    NotFoundException,
    UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { TicketsService } from "./tickets.service";
import { CreateTicketDto, UpdateTicketDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("tickets")
export class TicketsController {
    constructor(private readonly ticketsService: TicketsService) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll() {
        const tickets = await this.ticketsService.findAll();
        return { tickets };
    }

    /**
     * Create a new support ticket
     * Public endpoint - no auth required so users can submit tickets
     * even when experiencing login issues
     */
    @Post()
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 tickets per minute max
    async create(@Body() dto: CreateTicketDto) {
        const ticket = await this.ticketsService.create(dto);
        return { ok: true, ticket };
    }

    @Patch(":id")
    @UseGuards(JwtAuthGuard)
    async update(@Param("id") id: string, @Body() dto: UpdateTicketDto) {
        const ticket = await this.ticketsService.update(id, dto);
        if (!ticket) {
            throw new NotFoundException("Ticket not found");
        }
        return { ok: true, ticket };
    }

    // Migration endpoint
    @Post("migrate")
    @UseGuards(JwtAuthGuard)
    async migrate(@Body() body: { tickets: any[] }) {
        const results = await this.ticketsService.bulkCreate(body.tickets || []);
        return { ok: true, results };
    }
}
