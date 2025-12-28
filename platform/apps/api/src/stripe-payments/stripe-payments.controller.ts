import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    Headers,
    Req,
    UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { Roles } from "../auth/roles.decorator";
import { RequireScope } from "../permissions/require-scope.decorator";
import { UserRole } from "@prisma/client";

import { CustomerService } from "./customer.service";
import { PaymentMethodService } from "./payment-method.service";
import { TerminalService } from "./terminal.service";
import { TerminalPaymentService } from "./terminal-payment.service";
import { SavedCardService } from "./saved-card.service";
import { RefundService } from "./refund.service";

import {
    CreateCustomerDto,
    CreateSetupIntentDto,
    AttachPaymentMethodDto,
    UpdatePaymentMethodDto,
    CreateTerminalLocationDto,
    RegisterTerminalReaderDto,
    UpdateTerminalReaderDto,
    CreateTerminalPaymentDto,
    ProcessOnReaderDto,
    ChargeSavedCardDto,
    ChargeDefaultCardDto,
    ProcessRefundDto,
} from "./dto";

// =============================================================================
// CUSTOMER & PAYMENT METHOD CONTROLLER
// =============================================================================

@Controller("campgrounds/:campgroundId/guests/:guestId/payment-methods")
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class PaymentMethodController {
    constructor(
        private readonly customerService: CustomerService,
        private readonly paymentMethodService: PaymentMethodService,
    ) {}

    /**
     * List all saved payment methods for a guest
     */
    @Get()
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async listPaymentMethods(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
    ) {
        return this.paymentMethodService.listPaymentMethods(campgroundId, guestId);
    }

    /**
     * Get a specific payment method
     */
    @Get(":paymentMethodId")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async getPaymentMethod(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
        @Param("paymentMethodId") paymentMethodId: string,
    ) {
        return this.paymentMethodService.getPaymentMethod(campgroundId, guestId, paymentMethodId);
    }

    /**
     * Create a SetupIntent for adding a new payment method
     * Returns clientSecret for Stripe Elements on frontend
     */
    @Post("setup-intent")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async createSetupIntent(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
    ) {
        return this.paymentMethodService.createSetupIntent(campgroundId, guestId);
    }

    /**
     * Attach a payment method after SetupIntent is confirmed
     * Call this after Stripe.js confirms the SetupIntent
     */
    @Post()
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async attachPaymentMethod(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
        @Body() dto: AttachPaymentMethodDto,
        @Req() req: any,
    ) {
        return this.paymentMethodService.attachPaymentMethod(
            campgroundId,
            guestId,
            dto.stripePaymentMethodId,
            "staff",
            req.user?.id,
            dto.nickname,
            dto.setAsDefault,
        );
    }

    /**
     * Set a payment method as default
     */
    @Put(":paymentMethodId/default")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async setDefaultPaymentMethod(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
        @Param("paymentMethodId") paymentMethodId: string,
    ) {
        await this.customerService.setDefaultPaymentMethod(campgroundId, guestId, paymentMethodId);
        return { success: true };
    }

    /**
     * Update payment method nickname
     */
    @Put(":paymentMethodId")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async updatePaymentMethod(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
        @Param("paymentMethodId") paymentMethodId: string,
        @Body() dto: UpdatePaymentMethodDto,
    ) {
        if (dto.nickname) {
            return this.paymentMethodService.updatePaymentMethodNickname(
                campgroundId,
                guestId,
                paymentMethodId,
                dto.nickname,
            );
        }
        return this.paymentMethodService.getPaymentMethod(campgroundId, guestId, paymentMethodId);
    }

    /**
     * Remove a payment method
     */
    @Delete(":paymentMethodId")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    async removePaymentMethod(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
        @Param("paymentMethodId") paymentMethodId: string,
    ) {
        await this.paymentMethodService.removePaymentMethod(
            campgroundId,
            guestId,
            paymentMethodId,
        );
        return { success: true };
    }

    /**
     * Charge a saved payment method
     */
    @Post(":paymentMethodId/charge")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    async chargeSavedCard(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
        @Param("paymentMethodId") paymentMethodId: string,
        @Body() dto: ChargeSavedCardDto,
        @Headers("idempotency-key") idempotencyKey?: string,
    ) {
        const savedCardService = new SavedCardService(
            (this as any).prisma,
            (this as any).stripe,
        );
        return savedCardService.chargeSavedCard(
            campgroundId,
            guestId,
            paymentMethodId,
            dto.amountCents,
            dto.currency || "usd",
            dto.metadata || {},
            idempotencyKey,
        );
    }
}

// =============================================================================
// TERMINAL CONTROLLER
// =============================================================================

@Controller("campgrounds/:campgroundId/terminal")
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class TerminalController {
    constructor(
        private readonly terminalService: TerminalService,
        private readonly terminalPaymentService: TerminalPaymentService,
    ) {}

    // =========================================================================
    // LOCATIONS
    // =========================================================================

    @Get("locations")
    @RequireScope({ resource: "settings", action: "read" })
    @Roles(UserRole.owner, UserRole.manager)
    async listLocations(@Param("campgroundId") campgroundId: string) {
        return this.terminalService.listLocations(campgroundId);
    }

    @Post("locations")
    @RequireScope({ resource: "settings", action: "write" })
    @Roles(UserRole.owner, UserRole.manager)
    async createLocation(
        @Param("campgroundId") campgroundId: string,
        @Body() dto: CreateTerminalLocationDto,
    ) {
        return this.terminalService.createLocation(campgroundId, dto.displayName, {
            ...dto.address,
            country: dto.address.country || "US",
        });
    }

    @Get("locations/:locationId")
    @RequireScope({ resource: "settings", action: "read" })
    @Roles(UserRole.owner, UserRole.manager)
    async getLocation(
        @Param("campgroundId") campgroundId: string,
        @Param("locationId") locationId: string,
    ) {
        return this.terminalService.getLocation(campgroundId, locationId);
    }

    @Delete("locations/:locationId")
    @RequireScope({ resource: "settings", action: "write" })
    @Roles(UserRole.owner, UserRole.manager)
    async deleteLocation(
        @Param("campgroundId") campgroundId: string,
        @Param("locationId") locationId: string,
    ) {
        await this.terminalService.deleteLocation(campgroundId, locationId);
        return { success: true };
    }

    // =========================================================================
    // READERS
    // =========================================================================

    @Get("readers")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async listReaders(
        @Param("campgroundId") campgroundId: string,
        @Query("locationId") locationId?: string,
    ) {
        return this.terminalService.listReaders(campgroundId, locationId);
    }

    @Post("readers")
    @RequireScope({ resource: "settings", action: "write" })
    @Roles(UserRole.owner, UserRole.manager)
    async registerReader(
        @Param("campgroundId") campgroundId: string,
        @Body() dto: RegisterTerminalReaderDto,
    ) {
        return this.terminalService.registerReader(
            campgroundId,
            dto.registrationCode,
            dto.label,
            dto.locationId,
        );
    }

    @Get("readers/:readerId")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async getReader(
        @Param("campgroundId") campgroundId: string,
        @Param("readerId") readerId: string,
    ) {
        return this.terminalService.getReader(campgroundId, readerId);
    }

    @Put("readers/:readerId")
    @RequireScope({ resource: "settings", action: "write" })
    @Roles(UserRole.owner, UserRole.manager)
    async updateReader(
        @Param("campgroundId") campgroundId: string,
        @Param("readerId") readerId: string,
        @Body() dto: UpdateTerminalReaderDto,
    ) {
        return this.terminalService.updateReaderLabel(campgroundId, readerId, dto.label);
    }

    @Delete("readers/:readerId")
    @RequireScope({ resource: "settings", action: "write" })
    @Roles(UserRole.owner, UserRole.manager)
    async deleteReader(
        @Param("campgroundId") campgroundId: string,
        @Param("readerId") readerId: string,
    ) {
        await this.terminalService.deleteReader(campgroundId, readerId);
        return { success: true };
    }

    @Post("readers/:readerId/cancel-action")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async cancelReaderAction(
        @Param("campgroundId") campgroundId: string,
        @Param("readerId") readerId: string,
    ) {
        await this.terminalService.cancelReaderAction(campgroundId, readerId);
        return { success: true };
    }

    @Post("readers/:readerId/sync")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async syncReaderStatus(
        @Param("campgroundId") campgroundId: string,
        @Param("readerId") readerId: string,
    ) {
        return this.terminalService.syncReaderStatus(campgroundId, readerId);
    }

    // =========================================================================
    // CONNECTION TOKEN (for Terminal SDK)
    // =========================================================================

    @Post("connection-token")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async createConnectionToken(
        @Param("campgroundId") campgroundId: string,
        @Query("locationId") locationId?: string,
    ) {
        return this.terminalService.createConnectionToken(campgroundId, locationId);
    }

    // =========================================================================
    // TERMINAL PAYMENTS
    // =========================================================================

    @Post("payments")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async createTerminalPayment(
        @Param("campgroundId") campgroundId: string,
        @Body() dto: CreateTerminalPaymentDto,
        @Headers("idempotency-key") idempotencyKey?: string,
    ) {
        return this.terminalPaymentService.createTerminalPayment(
            campgroundId,
            dto.readerId,
            dto.amountCents,
            dto.currency || "usd",
            {
                ...(dto.metadata || {}),
                ...(dto.reservationId && { reservationId: dto.reservationId }),
            },
            {
                guestId: dto.guestId,
                saveCard: dto.saveCard,
                idempotencyKey,
            },
        );
    }

    @Post("payments/:paymentIntentId/process")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async processPaymentOnReader(
        @Param("campgroundId") campgroundId: string,
        @Param("paymentIntentId") paymentIntentId: string,
        @Body() dto: ProcessOnReaderDto,
    ) {
        return this.terminalPaymentService.processPaymentOnReader(
            campgroundId,
            dto.readerId,
            paymentIntentId,
        );
    }

    @Get("payments/:paymentIntentId/status")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async getPaymentStatus(
        @Param("campgroundId") campgroundId: string,
        @Param("paymentIntentId") paymentIntentId: string,
    ) {
        return this.terminalPaymentService.getPaymentStatus(campgroundId, paymentIntentId);
    }

    @Post("payments/:paymentIntentId/cancel")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async cancelTerminalPayment(
        @Param("campgroundId") campgroundId: string,
        @Param("paymentIntentId") paymentIntentId: string,
        @Body() dto: ProcessOnReaderDto,
    ) {
        await this.terminalPaymentService.cancelTerminalPayment(
            campgroundId,
            dto.readerId,
            paymentIntentId,
        );
        return { success: true };
    }
}

// =============================================================================
// SAVED CARD CONTROLLER (for charging cards on file)
// =============================================================================

@Controller("campgrounds/:campgroundId/saved-cards")
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class SavedCardController {
    constructor(private readonly savedCardService: SavedCardService) {}

    /**
     * Get chargeable payment methods for a guest
     */
    @Get("guest/:guestId")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.front_desk)
    async getChargeablePaymentMethods(
        @Param("campgroundId") campgroundId: string,
        @Param("guestId") guestId: string,
    ) {
        return this.savedCardService.getChargeablePaymentMethods(campgroundId, guestId);
    }

    /**
     * Charge a saved card
     */
    @Post("charge")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    async chargeSavedCard(
        @Param("campgroundId") campgroundId: string,
        @Body() dto: ChargeSavedCardDto,
        @Headers("idempotency-key") idempotencyKey?: string,
    ) {
        return this.savedCardService.chargeSavedCard(
            campgroundId,
            dto.guestId,
            dto.paymentMethodId,
            dto.amountCents,
            dto.currency || "usd",
            {
                ...(dto.metadata || {}),
                ...(dto.reservationId && { reservationId: dto.reservationId }),
                ...(dto.description && { description: dto.description }),
            },
            idempotencyKey,
        );
    }

    /**
     * Charge a guest's default card
     */
    @Post("charge-default")
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    async chargeDefaultCard(
        @Param("campgroundId") campgroundId: string,
        @Body() dto: ChargeDefaultCardDto,
        @Headers("idempotency-key") idempotencyKey?: string,
    ) {
        return this.savedCardService.chargeDefaultCard(
            campgroundId,
            dto.guestId,
            dto.amountCents,
            dto.currency || "usd",
            {
                ...(dto.metadata || {}),
                ...(dto.reservationId && { reservationId: dto.reservationId }),
            },
            idempotencyKey,
        );
    }
}

// =============================================================================
// REFUND CONTROLLER
// =============================================================================

@Controller("campgrounds/:campgroundId/payments/:paymentId/refund")
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class RefundController {
    constructor(private readonly refundService: RefundService) {}

    /**
     * Get refund eligibility for a payment
     * Shows max refundable amount and original payment method
     */
    @Get("eligibility")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    async getRefundEligibility(
        @Param("campgroundId") campgroundId: string,
        @Param("paymentId") paymentId: string,
    ) {
        return this.refundService.getRefundEligibility(campgroundId, paymentId);
    }

    /**
     * Get refund history for a payment
     */
    @Get("history")
    @RequireScope({ resource: "payments", action: "read" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    async getRefundHistory(
        @Param("campgroundId") campgroundId: string,
        @Param("paymentId") paymentId: string,
    ) {
        return this.refundService.getRefundHistory(campgroundId, paymentId);
    }

    /**
     * Process a refund
     * ALWAYS refunds to the original payment method (Stripe enforces this)
     */
    @Post()
    @RequireScope({ resource: "payments", action: "write" })
    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    async processRefund(
        @Param("campgroundId") campgroundId: string,
        @Param("paymentId") paymentId: string,
        @Body() dto: ProcessRefundDto,
        @Req() req: any,
        @Headers("idempotency-key") idempotencyKey?: string,
    ) {
        return this.refundService.processRefund(
            campgroundId,
            paymentId,
            dto.amountCents,
            dto.reason,
            dto.note,
            req.user?.id,
            idempotencyKey,
        );
    }
}
