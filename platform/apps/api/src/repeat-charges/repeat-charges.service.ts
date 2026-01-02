import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChargeStatus, PaymentSchedule, ReservationStatus } from '@prisma/client';
import { addDays, addMonths, addWeeks, startOfDay } from 'date-fns';
import { StripeService } from '../payments/stripe.service';
import { postBalancedLedgerEntries } from '../ledger/ledger-posting.util';

@Injectable()
export class RepeatChargesService {
    private readonly logger = new Logger(RepeatChargesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly stripeService: StripeService
    ) { }

    async generateCharges(reservationId: string) {
        const reservation = await this.prisma.reservation.findUnique({
            where: { id: reservationId },
            include: {
                seasonalRate: true,
                repeatCharges: true
            }
        });

        if (!reservation) throw new NotFoundException('Reservation not found');
        if (!reservation.seasonalRate) throw new BadRequestException('Reservation is not linked to a seasonal rate');

        const { paymentSchedule, amount, offseasonAmount, offseasonInterval } = reservation.seasonalRate;
        const arrival = new Date(reservation.arrivalDate);
        const departure = new Date(reservation.departureDate);

        // If charges already exist, we might want to skip or be careful not to duplicate
        if (reservation.repeatCharges.length > 0) {
            // For now, just return existing charges
            return reservation.repeatCharges;
        }

        const charges: { dueDate: Date; amount: number }[] = [];
        let currentDate = new Date(arrival);

        // Initial charge is usually handled by deposit/first payment, but for repeat billing we might want to schedule all future payments.
        // Assuming the first payment is covered by the initial booking transaction if it's "single" or "first_night".
        // But for "monthly", we generate subsequent months.

        // Logic depends on PaymentSchedule
        if (paymentSchedule === PaymentSchedule.monthly) {
            // Generate monthly charges starting from arrival (or 1 month after if first month paid?)
            // Let's assume the initial payment covers the first period, or we generate all and mark first as paid if needed.
            // For simplicity, let's generate all schedule dates.

            while (currentDate < departure) {
                charges.push({
                    dueDate: new Date(currentDate),
                    amount: amount // Monthly rate
                });
                currentDate = addMonths(currentDate, 1);
            }
        } else if (paymentSchedule === PaymentSchedule.weekly) {
            while (currentDate < departure) {
                charges.push({
                    dueDate: new Date(currentDate),
                    amount: amount // Weekly rate
                });
                currentDate = addWeeks(currentDate, 1);
            }
        } else if (paymentSchedule === PaymentSchedule.offseason_installments) {
            // Custom logic for offseason
            const interval = offseasonInterval || 1;
            const installmentAmount = offseasonAmount || amount;

            while (currentDate < departure) {
                charges.push({
                    dueDate: new Date(currentDate),
                    amount: installmentAmount
                });
                currentDate = addMonths(currentDate, interval);
            }
        }

        // Filter out charges that are past departure (shouldn't happen with while loop condition but good to check)
        // Also, usually the last charge might be prorated? 
        // For MVP, we'll stick to full periods.

        // Save to DB
        const createdCharges = [];
        for (const charge of charges) {
            const created = await this.prisma.repeatCharge.create({
                data: {
                    reservationId,
                    dueDate: charge.dueDate,
                    amount: charge.amount,
                    status: ChargeStatus.pending
                }
            });
            createdCharges.push(created);
        }

        return createdCharges;
    }

    async getCharges(reservationId: string) {
        return this.prisma.repeatCharge.findMany({
            where: { reservationId },
            orderBy: { dueDate: 'asc' }
        });
    }

    async getAllCharges(campgroundId: string) {
        return this.prisma.repeatCharge.findMany({
            where: {
                reservation: {
                    campgroundId
                }
            },
            include: {
                reservation: {
                    include: {
                        guest: true,
                        site: true
                    }
                }
            },
            orderBy: { dueDate: 'asc' }
        });
    }

    async processCharge(chargeId: string) {
        const charge = await this.prisma.repeatCharge.findUnique({
            where: { id: chargeId },
            include: {
                reservation: {
                    include: {
                        campground: {
                            select: {
                                stripeAccountId: true,
                                perBookingFeeCents: true
                            }
                        },
                        site: {
                            include: {
                                siteClass: true
                            }
                        }
                    }
                }
            }
        });

        if (!charge) throw new NotFoundException('Charge not found');
        if (charge.status === ChargeStatus.paid) throw new BadRequestException('Charge already paid');

        try {
            // Get the most recent successful payment to extract payment method details
            const lastPayment = await this.prisma.payment.findFirst({
                where: {
                    reservationId: charge.reservationId,
                    stripePaymentIntentId: { not: null }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!lastPayment?.stripePaymentIntentId) {
                const failureReason = 'No payment method on file';
                await this.prisma.repeatCharge.update({
                    where: { id: chargeId },
                    data: {
                        status: ChargeStatus.failed,
                        failedAt: new Date(),
                        failureReason
                    }
                });
                throw new BadRequestException(failureReason);
            }

            // Retrieve the original payment intent to get customer and payment method
            const originalIntent = await this.stripeService.retrievePaymentIntent(lastPayment.stripePaymentIntentId);

            if (!originalIntent.customer || !originalIntent.payment_method) {
                const failureReason = 'Payment method information not available';
                await this.prisma.repeatCharge.update({
                    where: { id: chargeId },
                    data: {
                        status: ChargeStatus.failed,
                        failedAt: new Date(),
                        failureReason
                    }
                });
                throw new BadRequestException(failureReason);
            }

            const customerId = typeof originalIntent.customer === 'string'
                ? originalIntent.customer
                : originalIntent.customer.id;
            const paymentMethodId = typeof originalIntent.payment_method === 'string'
                ? originalIntent.payment_method
                : originalIntent.payment_method.id;

            if (!charge.reservation.campground.stripeAccountId) {
                const failureReason = 'Payment processing not configured for this campground';
                await this.prisma.repeatCharge.update({
                    where: { id: chargeId },
                    data: {
                        status: ChargeStatus.failed,
                        failedAt: new Date(),
                        failureReason
                    }
                });
                throw new BadRequestException(failureReason);
            }

            const applicationFeeCents = charge.reservation.campground.perBookingFeeCents || 0;

            // Charge the saved payment method
            const paymentIntent = await this.stripeService.chargeOffSession(
                charge.amount,
                'usd',
                customerId,
                paymentMethodId,
                charge.reservation.campground.stripeAccountId,
                {
                    reservationId: charge.reservationId,
                    campgroundId: charge.reservation.campgroundId,
                    source: 'repeat_charge',
                    type: 'recurring_payment',
                    chargeId,
                    dueDate: charge.dueDate.toISOString()
                },
                applicationFeeCents,
                `repeat-charge-${chargeId}-${Date.now()}`
            );

            if (paymentIntent.status !== 'succeeded') {
                const failureReason = `Payment failed: ${paymentIntent.status}`;
                await this.prisma.repeatCharge.update({
                    where: { id: chargeId },
                    data: {
                        status: ChargeStatus.failed,
                        failedAt: new Date(),
                        failureReason
                    }
                });
                throw new BadRequestException(failureReason);
            }

            const updated = await this.prisma.$transaction(async (tx) => {
                // Update charge status
                const updatedCharge = await tx.repeatCharge.update({
                    where: { id: chargeId },
                    data: {
                        status: ChargeStatus.paid,
                        paidAt: new Date()
                    }
                });

                // Record the payment
                const payment = await tx.payment.create({
                    data: {
                        campgroundId: charge.reservation.campgroundId,
                        reservationId: charge.reservationId,
                        amountCents: charge.amount,
                        method: 'card',
                        direction: 'charge',
                        note: `Repeat charge for ${charge.dueDate.toISOString().split('T')[0]}`,
                        stripePaymentIntentId: paymentIntent.id,
                        stripeChargeId: paymentIntent.latest_charge as string | undefined,
                        applicationFeeCents,
                        capturedAt: new Date()
                    }
                });

                // Get current reservation to calculate new balance
                const currentRes = await tx.reservation.findUnique({
                    where: { id: charge.reservationId },
                    select: { totalAmount: true, paidAmount: true }
                });

                const newPaidAmount = (currentRes?.paidAmount || 0) + charge.amount;
                const newBalanceAmount = (currentRes?.totalAmount || 0) - newPaidAmount;
                const paymentStatus = newBalanceAmount <= 0 ? 'paid' : 'partial';

                // Update reservation paid amount, balance, and payment status
                await tx.reservation.update({
                    where: { id: charge.reservationId },
                    data: {
                        paidAmount: newPaidAmount,
                        balanceAmount: newBalanceAmount,
                        paymentStatus
                    }
                });

                // Post balanced ledger entries
                const revenueGl = charge.reservation.site?.siteClass?.glCode || 'SITE_REVENUE';
                const dedupeKey = `repeat_charge_${chargeId}_${payment.id}`;

                await postBalancedLedgerEntries(tx, [
                    {
                        campgroundId: charge.reservation.campgroundId,
                        reservationId: charge.reservationId,
                        glCode: 'CASH',
                        account: 'Cash',
                        direction: 'debit' as const,
                        amountCents: charge.amount,
                        description: `Repeat charge payment for ${charge.dueDate.toISOString().split('T')[0]}`,
                        dedupeKey: `${dedupeKey}:debit`
                    },
                    {
                        campgroundId: charge.reservation.campgroundId,
                        reservationId: charge.reservationId,
                        glCode: revenueGl,
                        account: 'Site Revenue',
                        direction: 'credit' as const,
                        amountCents: charge.amount,
                        description: `Repeat charge payment for ${charge.dueDate.toISOString().split('T')[0]}`,
                        dedupeKey: `${dedupeKey}:credit`
                    }
                ]);

                return updatedCharge;
            });

            return updated;
        } catch (error: any) {
            this.logger.error(`Payment failed for charge ${chargeId}: ${error.message}`, error.stack);

            // If not already marked as failed, update the charge status
            const currentCharge = await this.prisma.repeatCharge.findUnique({
                where: { id: chargeId },
                select: { status: true }
            });

            if (currentCharge?.status !== ChargeStatus.failed) {
                await this.prisma.repeatCharge.update({
                    where: { id: chargeId },
                    data: {
                        status: ChargeStatus.failed,
                        failedAt: new Date(),
                        failureReason: error.message || 'Payment processing error'
                    }
                });
            }

            throw error;
        }
    }
}
