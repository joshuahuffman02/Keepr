import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CheckInStatus, CheckOutStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SignaturesService } from '../signatures/signatures.service';
import { AuditService } from '../audit/audit.service';
import { AccessControlService } from '../access-control/access-control.service';
import { StripeService } from '../payments/stripe.service';
import { GatewayConfigService } from '../payments/gateway-config.service';
import { PoliciesService } from '../policies/policies.service';

export type CheckinResult = {
  status: 'completed' | 'failed';
  reason?: string;
  selfCheckInAt?: Date;
  signingUrl?: string;
};

export type CheckoutResult = {
  status: 'completed' | 'failed';
  reason?: string;
  selfCheckOutAt?: Date;
};

@Injectable()
export class SelfCheckinService {
  private readonly logger = new Logger(SelfCheckinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signatures: SignaturesService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly stripeService: StripeService,
    private readonly gatewayConfig: GatewayConfigService,
    private readonly policies: PoliciesService
  ) { }

  private async attachWaiverArtifacts(reservationId: string, guestId: string, evidence: { request?: any; artifact?: any; digital?: any }) {
    const ops: Promise<any>[] = [];

    if (evidence.request && (!evidence.request.reservationId || !evidence.request.guestId)) {
      ops.push(
        (this.prisma as any).signatureRequest?.update?.({
          where: { id: evidence.request.id },
          data: {
            reservationId: evidence.request.reservationId ?? reservationId,
            guestId: evidence.request.guestId ?? guestId
          }
        })
      );
    }

    if (evidence.artifact && (!evidence.artifact.reservationId || !evidence.artifact.guestId)) {
      ops.push(
        (this.prisma as any).signatureArtifact?.update?.({
          where: { id: evidence.artifact.id },
          data: {
            reservationId: evidence.artifact.reservationId ?? reservationId,
            guestId: evidence.artifact.guestId ?? guestId
          }
        })
      );
    }

    if (evidence.digital && (!evidence.digital.reservationId || !evidence.digital.guestId)) {
      ops.push(
        (this.prisma as any).digitalWaiver?.update?.({
          where: { id: evidence.digital.id },
          data: {
            reservationId: evidence.digital.reservationId ?? reservationId,
            guestId: evidence.digital.guestId ?? guestId
          }
        })
      );
    }

    if (ops.length) {
      try {
        await Promise.all(ops);
      } catch (err) {
        this.logger.warn("Failed to attach waiver artifacts to reservation", err);
      }
    }
  }

  private async hasSignedWaiver(reservationId: string, guestId: string) {
    const [signedRequest, digitalWaiver] = await Promise.all([
      (this.prisma as any).signatureRequest.findFirst?.({
        where: {
          documentType: "waiver",
          status: "signed",
          OR: [{ reservationId }, { reservationId: null, guestId }]
        },
        include: { artifact: true },
        orderBy: { signedAt: "desc" }
      }),
      (this.prisma as any).digitalWaiver.findFirst?.({
        where: {
          OR: [{ reservationId }, { reservationId: null, guestId }],
          status: "signed"
        },
        orderBy: { signedAt: "desc" }
      })
    ]);

    const signedArtifact =
      signedRequest?.artifact ??
      (await (this.prisma as any).signatureArtifact?.findFirst?.({
        where: {
          pdfUrl: { not: null },
          OR: [{ reservationId }, { reservationId: null, guestId }]
        }
      }));

    const hasEvidence = Boolean(signedRequest || signedArtifact || digitalWaiver);

    if (hasEvidence) {
      await this.attachWaiverArtifacts(reservationId, guestId, {
        request: signedRequest ?? undefined,
        artifact: signedArtifact ?? undefined,
        digital: digitalWaiver ?? undefined
      });
    }

    return hasEvidence;
  }

  private async attachIdVerification(reservationId: string, guestId: string, match: any) {
    if (!match || (match.reservationId && match.guestId)) return;
    try {
      await (this.prisma as any).idVerification?.update?.({
        where: { id: match.id },
        data: {
          reservationId: match.reservationId ?? reservationId,
          guestId: match.guestId ?? guestId
        }
      });
    } catch (err) {
      this.logger.warn("Failed to attach ID verification to reservation", err);
    }
  }

  private async hasVerifiedId(reservationId: string, guestId: string) {
    const now = new Date();
    const match = await (this.prisma as any).idVerification.findFirst?.({
      where: {
        status: "verified",
        OR: [
          { reservationId },
          {
            guestId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
          }
        ]
      },
      orderBy: { verifiedAt: "desc" }
    });

    if (match) {
      await this.attachIdVerification(reservationId, guestId, match);
      return true;
    }

    return false;
  }

  /**
   * Validate prerequisites for self check-in
   */
  async validateCheckinPrerequisites(reservationId: string): Promise<{
    valid: boolean;
    reason?: string;
    reasons?: string[];
    reservation?: any;
  }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { site: true, guest: true, campground: true },
    });

    if (!reservation) {
      return { valid: false, reason: 'reservation_not_found', reasons: ['reservation_not_found'] };
    }

    const reasons: string[] = [];

    if (reservation.paymentRequired && reservation.paymentStatus !== 'paid') {
      reasons.push('payment_required');
    }

    if (reservation.idVerificationRequired) {
      const verified = await this.hasVerifiedId(reservation.id, reservation.guestId);
      if (!verified) reasons.push('id_verification_required');
    }

    if (reservation.waiverRequired) {
      const signed = await this.hasSignedWaiver(reservation.id, reservation.guestId);
      if (!signed) reasons.push('waiver_required');
    }

    const policyCompliance = await this.policies.getPendingPolicyCompliance(reservation.id);
    if (!policyCompliance.ok) {
      reasons.push('policy_required');
    }

    if (!reservation.siteReady) {
      reasons.push('site_not_ready');
    }

    const outOfOrderTicket = await this.prisma.maintenanceTicket.findFirst({
      where: {
        siteId: reservation.siteId,
        outOfOrder: true,
        status: { notIn: ['closed'] },
      },
    });

    if (outOfOrderTicket) {
      reasons.push('site_out_of_order');
    }

    if (reasons.length) {
      return { valid: false, reason: reasons[0], reasons, reservation };
    }

    return { valid: true, reservation };
  }

  /**
   * Perform self check-in
   */
  async selfCheckin(
    reservationId: string,
    options?: { lateArrival?: boolean; override?: boolean; overrideReason?: string; actorId?: string | null },
  ): Promise<CheckinResult> {
    const validation = await this.validateCheckinPrerequisites(reservationId);
    const isOverride = Boolean(options?.override);

    if (!validation.valid && !isOverride) {
      const reservation = validation.reservation ?? await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { campground: true, guest: true },
      });

      const checkInStatus =
        validation.reason === "waiver_required"
          ? CheckInStatus.pending_waiver
          : validation.reason === "id_verification_required"
            ? CheckInStatus.pending_id
            : validation.reason === "payment_required"
              ? CheckInStatus.pending_payment
              : CheckInStatus.failed;

      const updatedReservation = reservation
        ? await this.prisma.reservation.update({
          where: { id: reservationId },
          data: { checkInStatus },
          include: { campground: true, guest: true },
        })
        : null;

      let signingUrl: string | undefined;
      if (validation.reason === "waiver_required" && validation.reservation) {
        const signatureResult = await this.signatures.autoSendForReservation(validation.reservation);
        signingUrl = (signatureResult as any)?.signingUrl;
      }
      if (validation.reason === "policy_required" && validation.reservation) {
        const policyCompliance = await this.policies.getPendingPolicyCompliance(validation.reservation.id);
        signingUrl = policyCompliance.signingUrl;
      }

      // Emit check-in failed communication
      try {
        if (updatedReservation) {
          await this.prisma.communication.create({
            data: {
              campgroundId: updatedReservation.campgroundId,
              guestId: updatedReservation.guestId,
              reservationId: updatedReservation.id,
              type: 'email',
              subject: `Check-in issue at ${updatedReservation.campground.name}`,
              body: `We couldn't complete your check-in. Reason: ${validation.reason?.replace('_', ' ')}. Please contact the front desk.`,
              status: 'queued',
              direction: 'outbound',
            },
          });
        }
      } catch (err) {
        this.logger.error('Failed to create checkin-failed communication:', err);
      }

      return { status: 'failed', reason: validation.reason, signingUrl };
    }

    if (isOverride && !validation.valid && validation.reservation) {
      try {
        await this.audit.record({
          campgroundId: validation.reservation.campgroundId,
          actorId: options?.actorId ?? null,
          action: "checkin.override",
          entity: "Reservation",
          entityId: reservationId,
          before: { unmet: validation.reasons ?? [] },
          after: { override: true, reason: options?.overrideReason ?? null }
        });
      } catch (err) {
        this.logger.error("Failed to audit check-in override", err);
      }
    }

    const now = new Date();
    const reservation = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkInStatus: CheckInStatus.completed,
        selfCheckInAt: now,
        lateArrivalFlag: options?.lateArrival ?? false,
        status: 'checked_in',
      },
      include: { campground: true, guest: true, site: true },
    });

    try {
      await this.accessControl.autoGrantForReservation(reservationId, options?.actorId ?? null);
    } catch (err) {
      this.logger.error("Failed to auto-grant access on self-checkin", err);
    }

    // Emit check-in success communication
    try {
      await this.prisma.communication.create({
        data: {
          campgroundId: reservation.campgroundId,
          guestId: reservation.guestId,
          reservationId: reservation.id,
          type: 'email',
          subject: `Welcome to ${reservation.campground.name}!`,
          body: `You're all checked in to site ${reservation.site.siteNumber}. Enjoy your stay!`,
          status: 'queued',
          direction: 'outbound',
        },
      });
    } catch (err) {
      this.logger.error('Failed to create checkin-success communication:', err);
    }

    return { status: 'completed', selfCheckInAt: now };
  }

  /**
   * Perform self checkout
   */
  async selfCheckout(
    reservationId: string,
    options?: {
      damageNotes?: string;
      damagePhotos?: string[];
      override?: boolean;
      actorId?: string | null;
    },
  ): Promise<CheckoutResult> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return { status: 'failed', reason: 'reservation_not_found' };
    }

    // Check for pending balance
    if (reservation.balanceAmount > 0 && !options?.override) {
      // Attempt to capture remaining balance using saved payment method
      const paymentResult = await this.attemptBalanceCollection(reservationId, reservation.balanceAmount);

      if (!paymentResult.success) {
        await this.prisma.reservation.update({
          where: { id: reservationId },
          data: { checkOutStatus: 'failed' },
        });
        return {
          status: 'failed',
          reason: paymentResult.reason || 'payment_capture_failed'
        };
      }
    }

    const now = new Date();
    const updatedReservation = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkOutStatus: 'completed',
        selfCheckOutAt: now,
        status: 'checked_out',
      },
      include: { campground: true, guest: true, site: true },
    });

    try {
      await this.accessControl.revokeAllForReservation(reservationId, "checked_out", options?.actorId ?? null);
    } catch (err) {
      this.logger.error("Failed to revoke access on self-checkout", err);
    }

    // Emit checkout success communication with receipt
    try {
      await this.prisma.communication.create({
        data: {
          campgroundId: updatedReservation.campgroundId,
          guestId: updatedReservation.guestId,
          reservationId: updatedReservation.id,
          type: 'email',
          subject: `Thank you for staying at ${updatedReservation.campground.name}!`,
          body: `You've successfully checked out. Final charges: $${(updatedReservation.totalAmount / 100).toFixed(2)}. We hope to see you again!`,
          status: 'queued',
          direction: 'outbound',
        },
      });
    } catch (err) {
      this.logger.error('Failed to create checkout-success communication:', err);
    }

    // If damage reported, create a follow-up task
    if (options?.damageNotes || options?.damagePhotos?.length) {
      try {
        await this.prisma.task.create({
          data: {
            tenantId: updatedReservation.campgroundId,
            type: 'inspection',
            state: 'pending',
            siteId: updatedReservation.siteId,
            reservationId: updatedReservation.id,
            slaStatus: 'on_track',
            notes: `Damage reported: ${options.damageNotes || 'See photos'}`,
            photos: options.damagePhotos ? JSON.stringify(options.damagePhotos) : undefined,
            source: 'auto_turnover',
            createdBy: 'system',
          },
        });
      } catch (err) {
        this.logger.error('Failed to create damage inspection task:', err);
      }
    }

    return { status: 'completed', selfCheckOutAt: now };
  }

  /**
   * Get check-in/out status for a reservation
   */
  async getStatus(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        checkInStatus: true,
        checkOutStatus: true,
        siteReady: true,
        siteReadyAt: true,
        selfCheckInAt: true,
        selfCheckOutAt: true,
        idVerificationRequired: true,
        waiverRequired: true,
        paymentRequired: true,
        lateArrivalFlag: true,
        paymentStatus: true,
        balanceAmount: true,
      },
    });

    if (!reservation) {
      throw new BadRequestException('Reservation not found');
    }

    return reservation;
  }

  /**
   * Attempt to collect the remaining balance for a reservation during checkout
   */
  private async attemptBalanceCollection(
    reservationId: string,
    balanceAmountCents: number
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Get reservation with campground info
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          campground: {
            select: {
              id: true,
              stripeAccountId: true,
              applicationFeeFlatCents: true,
              perBookingFeeCents: true,
              billingPlan: true,
              feeMode: true
            }
          }
        }
      });

      if (!reservation) {
        return { success: false, reason: 'reservation_not_found' };
      }

      const stripeAccountId = (reservation.campground as any)?.stripeAccountId;
      if (!stripeAccountId) {
        this.logger.warn(`No Stripe account for campground ${reservation.campgroundId}, cannot collect balance`);
        return { success: false, reason: 'payment_not_configured' };
      }

      // Check if Stripe is configured
      if (!this.stripeService.isConfigured()) {
        this.logger.warn('Stripe not configured, cannot collect balance');
        return { success: false, reason: 'payment_not_configured' };
      }

      // Check gateway config
      const gatewayConfig = await this.gatewayConfig.getConfig(reservation.campgroundId);
      if (!gatewayConfig || gatewayConfig.gateway !== 'stripe') {
        this.logger.warn(`Gateway not configured for campground ${reservation.campgroundId}`);
        return { success: false, reason: 'payment_not_configured' };
      }

      // Calculate application fee
      const plan = (reservation.campground as any)?.billingPlan as string | undefined;
      const planDefaultFee = plan === 'standard' ? 200 : plan === 'enterprise' ? 100 : 300;
      const applicationFeeCents =
        (reservation.campground as any)?.perBookingFeeCents ??
        (reservation.campground as any)?.applicationFeeFlatCents ??
        planDefaultFee;

      // Create payment intent for the balance
      const idempotencyKey = `checkout-balance-${reservationId}-${Date.now()}`;

      const paymentIntent = await this.stripeService.createPaymentIntent(
        balanceAmountCents,
        'usd',
        {
          reservationId,
          campgroundId: reservation.campgroundId,
          source: 'self_checkout',
          checkoutBalanceCollection: 'true'
        },
        stripeAccountId,
        applicationFeeCents,
        'automatic', // Auto-capture
        ['card'], // Only card for checkout
        idempotencyKey,
        'automatic'
      );

      this.logger.log(`Created payment intent ${paymentIntent.id} for checkout balance collection`);

      // For self-checkout, we need the guest to complete the payment
      // Store the payment intent ID on the reservation for the frontend to handle
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: {
          checkoutPaymentIntentId: paymentIntent.id,
          checkoutPaymentIntentSecret: paymentIntent.client_secret
        } as any
      });

      // Return success with intent info - frontend will need to complete payment
      return {
        success: true,
        reason: 'payment_required'
      };
    } catch (error: any) {
      this.logger.error(`Failed to collect checkout balance for ${reservationId}: ${error.message}`, error.stack);
      return {
        success: false,
        reason: error.message || 'payment_error'
      };
    }
  }
}
