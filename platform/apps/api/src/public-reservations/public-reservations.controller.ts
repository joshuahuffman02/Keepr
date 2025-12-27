import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PublicReservationsService } from "./public-reservations.service";
import { CreatePublicReservationDto, PublicQuoteDto, CreatePublicWaitlistDto, CreateDemoRequestDto } from "./dto/create-public-reservation.dto";
import { FormsService } from "../forms/forms.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

@Controller("public")
export class PublicReservationsController {
    constructor(
        private readonly service: PublicReservationsService,
        private readonly formsService: FormsService,
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
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
     * Get form submissions for a reservation
     */
    @Get("reservations/:id/form-submissions")
    async getReservationFormSubmissions(@Param("id") id: string) {
        return this.formsService.getReservationFormSubmissions(id);
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

    /**
     * Submit a demo request from the marketing website
     */
    @Post("demo-request")
    async submitDemoRequest(@Body() dto: CreateDemoRequestDto) {
        // Store the demo request in the database
        const demoRequest = await this.prisma.demoRequest.create({
            data: {
                name: dto.name,
                email: dto.email,
                phone: dto.phone || null,
                campgroundName: dto.campgroundName,
                siteCount: dto.sites,
                message: dto.message || null,
                source: "website",
            },
        });

        // Send notification email to sales team
        try {
            await this.emailService.sendEmail({
                to: "sales@campeveryday.com",
                subject: `New Demo Request: ${dto.campgroundName}`,
                html: `
                    <h2>New Demo Request</h2>
                    <table style="border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${dto.name}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${dto.email}">${dto.email}</a></td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${dto.phone || "Not provided"}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Campground:</td><td style="padding: 8px;">${dto.campgroundName}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Site Count:</td><td style="padding: 8px;">${dto.sites}</td></tr>
                        ${dto.message ? `<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Message:</td><td style="padding: 8px;">${dto.message}</td></tr>` : ""}
                    </table>
                    <p style="color: #666; font-size: 12px;">Request ID: ${demoRequest.id}</p>
                `,
            });
        } catch {
            // Don't fail the request if email fails - the data is already stored
            console.error("Failed to send demo request notification email");
        }

        return { success: true, id: demoRequest.id };
    }
}
