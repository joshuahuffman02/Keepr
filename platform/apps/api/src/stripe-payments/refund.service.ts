import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

export interface RefundEligibility {
    canRefund: boolean;
    maxRefundableAmountCents: number;
    alreadyRefundedCents: number;
    originalPaymentMethod: {
        type: string;
        last4: string | null;
        brand: string | null;
    } | null;
    reason?: string;
}

export interface RefundResult {
    refundId: string;
    status: string;
    amountCents: number;
    paymentMethodType: string | null;
    paymentMethodLast4: string | null;
}

@Injectable()
export class RefundService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly stripe: StripeService,
    ) {}

    /**
     * Get refund eligibility for a payment
     * Shows max refundable amount and original payment method
     */
    async getRefundEligibility(
        campgroundId: string,
        paymentId: string,
    ): Promise<RefundEligibility> {
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, campgroundId },
        });

        if (!payment) {
            throw new NotFoundException("Payment not found");
        }

        // Check if it's a charge (not already a refund)
        if (payment.direction !== "charge") {
            return {
                canRefund: false,
                maxRefundableAmountCents: 0,
                alreadyRefundedCents: 0,
                originalPaymentMethod: null,
                reason: "This is not a charge - cannot refund",
            };
        }

        // Check if there's a Stripe payment intent
        if (!payment.stripePaymentIntentId) {
            return {
                canRefund: false,
                maxRefundableAmountCents: 0,
                alreadyRefundedCents: 0,
                originalPaymentMethod: null,
                reason: "No Stripe payment intent found - may be a cash or manual payment",
            };
        }

        // Calculate already refunded amount
        const alreadyRefundedCents = payment.refundedAmountCents || 0;
        const maxRefundableAmountCents = payment.amountCents - alreadyRefundedCents;

        if (maxRefundableAmountCents <= 0) {
            return {
                canRefund: false,
                maxRefundableAmountCents: 0,
                alreadyRefundedCents,
                originalPaymentMethod: {
                    type: payment.paymentMethodType || "unknown",
                    last4: payment.paymentMethodLast4,
                    brand: payment.paymentMethodBrand,
                },
                reason: "Payment has already been fully refunded",
            };
        }

        return {
            canRefund: true,
            maxRefundableAmountCents,
            alreadyRefundedCents,
            originalPaymentMethod: {
                type: payment.paymentMethodType || "unknown",
                last4: payment.paymentMethodLast4,
                brand: payment.paymentMethodBrand,
            },
        };
    }

    /**
     * Process a refund - ALWAYS to original payment method
     * Stripe automatically handles refunding to the original payment method.
     * This service enforces that we never try to redirect refunds.
     */
    async processRefund(
        campgroundId: string,
        paymentId: string,
        amountCents?: number, // If not provided, full refund
        reason?: "duplicate" | "fraudulent" | "requested_by_customer",
        note?: string,
        actorId?: string,
        idempotencyKey?: string,
    ): Promise<RefundResult> {
        // Get payment
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, campgroundId },
        });

        if (!payment) {
            throw new NotFoundException("Payment not found");
        }

        // Validate refund eligibility
        const eligibility = await this.getRefundEligibility(campgroundId, paymentId);

        if (!eligibility.canRefund) {
            throw new BadRequestException(eligibility.reason || "Payment cannot be refunded");
        }

        // Validate amount
        const refundAmountCents = amountCents ?? eligibility.maxRefundableAmountCents;

        if (refundAmountCents <= 0) {
            throw new BadRequestException("Refund amount must be greater than 0");
        }

        if (refundAmountCents > eligibility.maxRefundableAmountCents) {
            throw new BadRequestException(
                `Refund amount exceeds maximum refundable amount of ${eligibility.maxRefundableAmountCents / 100}`,
            );
        }

        // Get campground
        const campground = await this.prisma.campground.findUnique({
            where: { id: campgroundId },
            select: { stripeAccountId: true },
        });

        if (!campground?.stripeAccountId) {
            throw new BadRequestException("Campground is not connected to Stripe");
        }

        // Process refund via Stripe
        // IMPORTANT: Stripe automatically refunds to the original payment method
        // There is NO option to specify a different destination
        const refund = await this.stripe.createRefundOnConnectedAccount(
            campground.stripeAccountId,
            payment.stripePaymentIntentId!,
            refundAmountCents,
            reason,
            idempotencyKey,
        );

        // Update payment record
        const newRefundedTotal = (payment.refundedAmountCents || 0) + refundAmountCents;
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                refundedAmountCents: newRefundedTotal,
                refundedAt: new Date(),
            },
        });

        // Create refund record (positive amount with refund direction)
        const refundPayment = await this.prisma.payment.create({
            data: {
                campgroundId,
                reservationId: payment.reservationId,
                amountCents: refundAmountCents,
                method: payment.method,
                direction: "refund",
                note: note || `Refund for payment ${paymentId}`,
                stripePaymentIntentId: `refund_${refund.id}`, // Unique ID for refund
                stripeChargeId: refund.charge as string | undefined,
                methodType: payment.paymentMethodType,
                stripePaymentMethodId: payment.stripePaymentMethodId,
                paymentMethodType: payment.paymentMethodType,
                paymentMethodLast4: payment.paymentMethodLast4,
                paymentMethodBrand: payment.paymentMethodBrand,
                paymentSource: "refund",
                originalPaymentId: paymentId,
            },
        });

        // Update reservation paidAmount and balanceAmount
        if (payment.reservationId) {
            const reservation = await this.prisma.reservation.findUnique({
                where: { id: payment.reservationId },
                select: { totalAmount: true, paidAmount: true }
            });

            if (reservation) {
                const newPaidAmount = Math.max(0, (reservation.paidAmount || 0) - refundAmountCents);
                const newBalanceAmount = (reservation.totalAmount || 0) - newPaidAmount;
                const paymentStatus = newBalanceAmount <= 0 ? 'paid' : 'partial';

                await this.prisma.reservation.update({
                    where: { id: payment.reservationId },
                    data: {
                        paidAmount: newPaidAmount,
                        balanceAmount: newBalanceAmount,
                        paymentStatus
                    }
                });
            }

            // Post balanced ledger entries for refund (reverse the original: credit Cash, debit Revenue)
            const dedupeKey = `refund_${refund.id}_${refundPayment.id}`;
            await postBalancedLedgerEntries(this.prisma, [
                {
                    campgroundId,
                    reservationId: payment.reservationId,
                    glCode: "CASH",
                    account: "Cash",
                    description: `Refund for payment ${paymentId}`,
                    amountCents: refundAmountCents,
                    direction: "credit" as const, // Credit reduces Cash (money going out)
                    dedupeKey: `${dedupeKey}:credit`
                },
                {
                    campgroundId,
                    reservationId: payment.reservationId,
                    glCode: "SITE_REVENUE",
                    account: "Site Revenue",
                    description: `Refund for payment ${paymentId}`,
                    amountCents: refundAmountCents,
                    direction: "debit" as const, // Debit reduces Revenue
                    dedupeKey: `${dedupeKey}:debit`
                }
            ]);
        }

        // Log to payment audit log
        await this.prisma.paymentAuditLog.create({
            data: {
                campgroundId,
                actorId,
                action: "payment.refunded",
                entityType: "payment",
                entityId: paymentId,
                before: {
                    refundedAmountCents: payment.refundedAmountCents || 0,
                },
                after: {
                    refundedAmountCents: newRefundedTotal,
                    refundId: refund.id,
                    refundAmountCents,
                    reason,
                    note,
                },
                metadata: {
                    paymentMethodType: payment.paymentMethodType,
                    paymentMethodLast4: payment.paymentMethodLast4,
                    stripeRefundId: refund.id,
                },
            },
        });

        return {
            refundId: refund.id,
            status: refund.status,
            amountCents: refund.amount,
            paymentMethodType: payment.paymentMethodType,
            paymentMethodLast4: payment.paymentMethodLast4,
        };
    }

    /**
     * Get refund history for a payment
     */
    async getRefundHistory(
        campgroundId: string,
        paymentId: string,
    ): Promise<
        Array<{
            id: string;
            amountCents: number;
            createdAt: Date;
            note: string | null;
        }>
    > {
        const refunds = await this.prisma.payment.findMany({
            where: {
                campgroundId,
                originalPaymentId: paymentId,
                direction: "refund",
            },
            select: {
                id: true,
                amountCents: true,
                createdAt: true,
                note: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return refunds.map(r => ({
            id: r.id,
            amountCents: Math.abs(r.amountCents), // Return as positive
            createdAt: r.createdAt,
            note: r.note,
        }));
    }
}
