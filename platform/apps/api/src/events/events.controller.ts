import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { EventsService } from "./events.service";
import { CreateEventSchema, EventSchema } from "@keepr/shared";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { z } from "zod";
import { JwtAuthGuard } from "../auth/guards";
import { AuthGuard } from "@nestjs/passport";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Admin/staff endpoints
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateEventSchema))
    createEventDto: z.infer<typeof CreateEventSchema>,
  ) {
    const cleaned = {
      ...createEventDto,
      parentEventId: createEventDto.parentEventId || undefined,
      recurrenceEndDate: createEventDto.recurrenceEndDate || undefined,
      recurrenceDays: createEventDto.recurrenceDays || undefined,
    };
    return this.eventsService.create(cleaned);
  }

  // Admin/staff listing
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query("campgroundId") campgroundId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
  ) {
    return this.eventsService.findAll(campgroundId, start, end);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.eventsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateEventDto: Partial<z.infer<typeof CreateEventSchema>>,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.eventsService.remove(id);
  }

  // Guest portal: list events within a date range for a campground (guest JWT)
  @UseGuards(AuthGuard("guest-jwt"))
  @Get("public/list")
  async listPublic(
    @Query("campgroundId") campgroundId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
  ) {
    return this.eventsService.findAll(campgroundId, start, end);
  }
}
