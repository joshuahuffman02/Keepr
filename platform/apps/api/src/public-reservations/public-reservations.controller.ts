import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PublicReservationsService } from "./public-reservations.service";
import { CreatePublicReservationDto, PublicQuoteDto, CreatePublicWaitlistDto } from "./dto/create-public-reservation.dto";

@Controller("public")
export class PublicReservationsController {
    constructor(private readonly service: PublicReservationsService) { }

    @Get("campgrounds/:slug/availability")
    getAvailability(
        @Param("slug") slug: string,
        @Query("arrivalDate") arrivalDate: string,
    @Query("departureDate") departureDate: string,
        @Query("rigType") rigType?: string,
        @Query("rigLength") rigLength?: string,
        @Query("needsAccessible") needsAccessible?: string
    ) {
        const needsAccessibleBool = needsAccessible === "true" || needsAccessible === "1";
        return this.service.getAvailability(slug, arrivalDate, departureDate, rigType, rigLength, needsAccessibleBool);
    }

    @Post("campgrounds/:slug/quote")
    getQuote(@Param("slug") slug: string, @Body() dto: PublicQuoteDto) {
        return this.service.getQuote(slug, dto);
    }

    @Post("reservations")
    createReservation(@Body() dto: CreatePublicReservationDto) {
        return this.service.createReservation(dto);
    }

  @Post("reservations/abandon")
  abandonCart(@Body() body: { campgroundId: string; email?: string; phone?: string; abandonedAt?: string }) {
    return this.service.abandonCart(body);
  }

    @Post("waitlist")
    joinWaitlist(@Body() dto: CreatePublicWaitlistDto) {
        return this.service.createPublicWaitlistEntry(dto);
    }

    @Post("reservations/:id/kiosk-checkin")
    kioskCheckIn(@Param("id") id: string, @Body() body: { upsellTotalCents: number }) {
        return this.service.kioskCheckIn(id, body.upsellTotalCents || 0);
    }

    @Get("reservations/:id")
    getReservation(@Param("id") id: string) {
        return this.service.getReservation(id);
    }
}
