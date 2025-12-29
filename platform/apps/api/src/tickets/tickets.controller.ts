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
import { TicketsService } from "./tickets.service";
import { CreateTicketDto, UpdateTicketDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("tickets")
@UseGuards(JwtAuthGuard)
export class TicketsController {
    constructor(private readonly ticketsService: TicketsService) { }

    @Get()
    async findAll() {
        const tickets = await this.ticketsService.findAll();
        return { tickets };
    }

    @Post()
    async create(@Body() dto: CreateTicketDto) {
        const ticket = await this.ticketsService.create(dto);
        return { ok: true, ticket };
    }

    @Patch(":id")
    async update(@Param("id") id: string, @Body() dto: UpdateTicketDto) {
        const ticket = await this.ticketsService.update(id, dto);
        if (!ticket) {
            throw new NotFoundException("Ticket not found");
        }
        return { ok: true, ticket };
    }

    // Migration endpoint
    @Post("migrate")
    async migrate(@Body() body: { tickets: any[] }) {
        const results = await this.ticketsService.bulkCreate(body.tickets || []);
        return { ok: true, results };
    }
}
