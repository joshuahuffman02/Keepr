import { Body, Controller, Get, Param, Post, Query, BadRequestException, Logger, Headers } from "@nestjs/common";
import { PublicReservationsService } from "./public-reservations.service";
import { CreatePublicReservationDto, PublicQuoteDto, CreatePublicWaitlistDto, CreateDemoRequestDto } from "./dto/create-public-reservation.dto";
import { FormsService } from "../forms/forms.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { AiNaturalSearchService } from "../ai/ai-natural-search.service";
import { Throttle } from "@nestjs/throttler";

@Controller("public")
@Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per IP
export class PublicReservationsController {
    private readonly logger = new Logger(PublicReservationsController.name);

    constructor(
        private readonly service: PublicReservationsService,
        private readonly formsService: FormsService,
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
        private readonly nlSearch: AiNaturalSearchService,
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

    /**
     * Natural Language Search for available sites
     *
     * Accepts plain English queries like:
     * - "Pet-friendly RV site next weekend under $50/night"
     * - "Cabin for 4 adults July 4th weekend"
     * - "Waterfront tent site with hookups this Friday to Sunday"
     *
     * Uses AI to parse the query and return ranked, matching sites.
     * Falls back to basic parsing if AI is not enabled for the campground.
     */
    @Post("campgrounds/:slug/search")
    @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute (AI calls are expensive)
    async naturalLanguageSearch(
        @Param("slug") slug: string,
        @Body() body: { query: string; sessionId?: string }
    ) {
        if (!body.query || body.query.trim().length < 3) {
            throw new BadRequestException("Search query must be at least 3 characters");
        }

        if (body.query.length > 500) {
            throw new BadRequestException("Search query too long (max 500 characters)");
        }

        try {
            return await this.nlSearch.search(slug, body.query.trim(), body.sessionId);
        } catch (error) {
            this.logger.error(`NL search failed for ${slug}:`, error);
            throw new BadRequestException(
                "Search failed. Please try again or use the standard availability search."
            );
        }
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
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // Stricter rate limit: 10 per minute
    kioskCheckIn(
        @Param("id") id: string,
        @Body() body: { upsellTotalCents: number },
        @Headers("x-kiosk-token") kioskToken: string
    ) {
        if (!kioskToken) {
            throw new BadRequestException("kiosk token required");
        }
        return this.service.kioskCheckIn(id, body.upsellTotalCents || 0, kioskToken);
    }

    @Get("reservations/:id")
    @Throttle({ default: { limit: 20, ttl: 60000 } }) // Moderate rate limit: 20 per minute
    getReservation(
        @Param("id") id: string,
        @Query("token") token?: string
    ) {
        // SECURITY: Require signed token for public reservation access
        if (!token) {
            throw new BadRequestException("access token required");
        }
        return this.service.getReservation(id, token);
    }

    /**
     * Get form submissions for a reservation
     * SECURITY: Requires campgroundId to prevent IDOR
     */
    @Get("reservations/:id/form-submissions")
    async getReservationFormSubmissions(
        @Param("id") id: string,
        @Query("token") token?: string
    ) {
        // SECURITY: Require signed token for public reservation access
        if (!token) {
            throw new BadRequestException("access token required");
        }
        return this.formsService.getReservationFormSubmissions(id, token);
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
     * SECURITY: Requires campgroundId query parameter to validate form belongs to campground
     */
    @Get("forms/:id")
    async getPublicForm(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string
    ) {
        return this.formsService.getPublicForm(id, campgroundId);
    }

    /**
     * Submit a completed form during booking
     * SECURITY: Requires campgroundId in body to validate form/reservation belong to campground
     */
    @Post("forms/submit")
    async submitPublicForm(
        @Body() body: {
            formTemplateId: string;
            campgroundId: string;
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
        // SECURITY: Escape HTML special characters to prevent injection
        const escapeHtml = (str: string): string =>
            str.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");

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

        // Send notification email to sales team (with escaped user input)
        try {
            const safeName = escapeHtml(dto.name);
            const safeEmail = escapeHtml(dto.email);
            const safePhone = dto.phone ? escapeHtml(dto.phone) : "Not provided";
            const safeCampgroundName = escapeHtml(dto.campgroundName);
            const safeMessage = dto.message ? escapeHtml(dto.message) : null;

            await this.emailService.sendEmail({
                to: "sales@keeprstay.com",
                subject: `New Demo Request: ${safeCampgroundName}`,
                html: `
                    <h2>New Demo Request</h2>
                    <table style="border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${safeName}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${safePhone}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Campground:</td><td style="padding: 8px;">${safeCampgroundName}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Site Count:</td><td style="padding: 8px;">${dto.sites}</td></tr>
                        ${safeMessage ? `<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Message:</td><td style="padding: 8px;">${safeMessage}</td></tr>` : ""}
                    </table>
                    <p style="color: #666; font-size: 12px;">Request ID: ${demoRequest.id}</p>
                `,
            });
        } catch (error) {
            // Don't fail the request if email fails - the data is already stored
            this.logger.error("Failed to send demo request notification email", error instanceof Error ? error.stack : error);
        }

        return { success: true, id: demoRequest.id };
    }
}
