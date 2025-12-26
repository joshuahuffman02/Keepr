import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PublicReservationsService } from "./public-reservations.service";
import { CreatePublicReservationDto, PublicQuoteDto, CreatePublicWaitlistDto } from "./dto/create-public-reservation.dto";
import { FormsService } from "../forms/forms.service";

@Controller("public")
export class PublicReservationsController {
    constructor(
        private readonly service: PublicReservationsService,
        private readonly formsService: FormsService
    ) { }

    @Get("campgrounds/:slug/availability")
    getAvailability(
        @Param("slug") slug: string,
        @Query("arrivalDate") arrivalDate: string,
        @Query("departureDate") departureDate: string,
        @Query("rigType") rigType?: string,
        @Query("rigLength") rigLength?: string,
        @Query("needsAccessible") needsAccessible?: string,
        @Query("token") token?: string
    ) {
        const needsAccessibleBool = needsAccessible === "true" || needsAccessible === "1";
        return this.service.getAvailability(slug, arrivalDate, departureDate, rigType, rigLength, needsAccessibleBool, token);
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

    /**
     * Get active forms for a campground during booking/check-in
     * Query params:
     * - showAt: Filter by timing ("during_booking", "at_checkin", "after_booking")
     */
    @Get("campgrounds/:campgroundId/forms")
    async getPublicForms(
        @Param("campgroundId") campgroundId: string,
        @Query("showAt") showAt?: string
    ) {
        return this.formsService.listPublicForms(campgroundId, showAt);
    }

    /**
     * Get a single form template for filling out
     */
    @Get("forms/:id")
    async getPublicForm(@Param("id") id: string) {
        return this.formsService.getPublicForm(id);
    }

    /**
     * Submit a completed form during booking
     */
    @Post("forms/submit")
    async submitPublicForm(
        @Body() body: {
            formTemplateId: string;
            reservationId?: string;
            guestEmail?: string;
            responses: Record<string, any>;
        }
    ) {
        return this.formsService.submitPublicForm(body);
    }
}
