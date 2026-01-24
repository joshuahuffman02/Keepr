import { Controller, Get, Query } from "@nestjs/common";
import { PublicEventsService, PublicEventSearchResult } from "./public-events.service";
import { EventType } from "@prisma/client";

@Controller("public/events")
export class PublicEventsController {
  constructor(private readonly eventsService: PublicEventsService) {}

  @Get()
  async searchEvents(
    @Query("state") state?: string,
    @Query("eventType") eventType?: EventType,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<PublicEventSearchResult> {
    return this.eventsService.searchPublicEvents({
      state: state?.toUpperCase(),
      eventType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 24,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get("types")
  async getEventTypes(): Promise<EventType[]> {
    return this.eventsService.getEventTypes();
  }
}
