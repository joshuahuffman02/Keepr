import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { ReservationStatus, ReferralIncentiveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePublicReservationDto, PublicQuoteDto, CreatePublicWaitlistDto } from './dto/create-public-reservation.dto';
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { EmailService } from '../email/email.service';
import { AbandonedCartService } from "../abandoned-cart/abandoned-cart.service";
import { differenceInMinutes } from "date-fns";
import { resolveDiscounts } from "../pricing-v2/discount-engine";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { TaxRuleType } from "@prisma/client";
import { MembershipsService } from "../memberships/memberships.service";
import { SignaturesService } from "../signatures/signatures.service";
import { PoliciesService } from "../policies/policies.service";
import { AccessControlService } from "../access-control/access-control.service";
import { assertSiteLockValid } from "../reservations/reservation-guards";
import { evaluatePricingV2 } from "../reservations/reservation-pricing";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { calculateReservationDepositV2 } from "../reservations/reservation-deposit";
import { StripeService } from "../payments/stripe.service";

@Injectable()
export class PublicReservationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly locks: LockService,
        private readonly promotionsService: PromotionsService,
        private readonly emailService: EmailService,
        private readonly abandonedCarts: AbandonedCartService,
        private readonly memberships: MembershipsService,
        private readonly signatures: SignaturesService,
        private readonly policies: PoliciesService,
        private readonly accessControl: AccessControlService,
        private readonly pricingV2Service: PricingV2Service,
        private readonly depositPoliciesService: DepositPoliciesService,
        private readonly stripeService: StripeService
    ) { }

    private async hasSignedWaiver(reservationId: string, guestId: string) {
        const [signedSignature, signedArtifact, digitalWaiver] = await Promise.all([
            (this.prisma as any).signatureRequest.findFirst?.({
                where: { reservationId, documentType: "waiver", status: "signed" }
            }),
            (this.prisma as any).signatureArtifact.findFirst?.({
                where: { reservationId, pdfUrl: { not: null } }
            }),
            (this.prisma as any).digitalWaiver.findFirst?.({
                where: {
                    OR: [{ reservationId }, { reservationId: null, guestId }],
                    status: "signed"
                }
            })
        ]);
        return Boolean(signedSignature || signedArtifact || digitalWaiver);
    }

    private async hasVerifiedId(reservationId: string, guestId: string) {
        const now = new Date();
        const match = await (this.prisma as any).idVerification.findFirst?.({
            where: {
                OR: [
                    { reservationId, status: "verified" },
                    { guestId, status: "verified", expiresAt: { gt: now } }
                ]
            }
        });
        return Boolean(match);
    }

    /**
     * Join waitlist publicly (creates guest if needed)
     */
    async createPublicWaitlistEntry(dto: CreatePublicWaitlistDto) {
        // Validation
        const arrival = new Date(dto.arrivalDate);
        const departure = new Date(dto.departureDate);

        if (isNaN(arrival.getTime()) || isNaN(departure.getTime()) || arrival >= departure) {
            throw new BadRequestException("Invalid dates");
        }

        // Find or create guest
        let guest = await this.prisma.guest.findUnique({
            where: { email: dto.email }
        });

        if (!guest) {
            guest = await this.prisma.guest.create({
                data: {
                    email: dto.email,
                    primaryFirstName: dto.firstName,
                    primaryLastName: dto.lastName,
                    phone: dto.phone || "",
                    // Minimal guest record
                }
            });
        }

        // Create waitlist entry
        return this.prisma.waitlistEntry.create({
            data: {
                campgroundId: dto.campgroundId,
                guestId: guest.id,
                siteId: dto.siteId,
                siteTypeId: dto.siteClassId, // Map siteClassId to siteTypeId
                arrivalDate: arrival,
                departureDate: departure,
                status: 'active',
                type: 'regular'
            }
        });
    }

    private async enqueueAbandonedCartPlaybooks(campgroundId: string, guestId?: string | null, reservationId?: string | null) {
        const playbooks = await (this.prisma as any).communicationPlaybook.findMany({
            where: { campgroundId, type: "abandoned_cart", enabled: true, templateId: { not: null } }
        });
        for (const pb of playbooks as any[]) {
            const tpl = await (this.prisma as any).communicationTemplate.findFirst({
                where: { id: pb.templateId, status: "approved" }
            });
            if (!tpl) continue;
            const scheduledAt = new Date();
            if (pb.offsetMinutes && Number.isFinite(pb.offsetMinutes)) {
                scheduledAt.setMinutes(scheduledAt.getMinutes() + pb.offsetMinutes);
            }
            await (this.prisma as any).communicationPlaybookJob.create({
                data: {
                    playbookId: pb.id,
                    campgroundId,
                    reservationId: reservationId ?? null,
                    guestId: guestId ?? null,
                    status: "pending",
                    scheduledAt
                }
            });
        }
    }

    // ... existing code ...


    private computeNights(arrival: Date, departure: Date) {
        const ms = departure.getTime() - arrival.getTime();
        if (!Number.isFinite(ms) || ms <= 0) return 1;
        return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
    }

    private computePaymentStatus(total: number, paid: number): string {
        if (!total || total <= 0) return "unpaid";
        if (paid >= total) return "paid";
        if (paid > 0) return "partial";
        return "unpaid";
    }

    private async resolveReferralProgram(
        campgroundId: string,
        referralCode?: string | null,
        referralProgramId?: string | null,
        basisCents?: number
    ) {
        if (!referralCode && !referralProgramId) {
            return { program: null, discountCents: 0, type: null, value: 0, source: null, channel: null };
        }

        const program = await (this.prisma as any).referralProgram.findFirst({
            where: {
                campgroundId,
                isActive: true,
                OR: [
                    referralProgramId ? { id: referralProgramId } : undefined,
                    referralCode ? { code: referralCode } : undefined,
                    referralCode ? { linkSlug: referralCode } : undefined
                ].filter(Boolean) as any[]
            }
        });

        if (!program) {
            throw new BadRequestException("Invalid or inactive referral code");
        }

        const type = program.incentiveType as ReferralIncentiveType;
        const value = program.incentiveValue ?? 0;
        const basis = Math.max(0, basisCents ?? 0);
        let discountCents = 0;

        if (type === ReferralIncentiveType.percent_discount) {
            discountCents = Math.min(basis, Math.floor(basis * (value / 100)));
        } else {
            discountCents = Math.min(basis, Math.max(0, value));
        }

        return {
            program,
            discountCents,
            type,
            value,
            source: program.source ?? null,
            channel: program.channel ?? null
        };
    }

    /**
     * Compute taxes for a given campground and taxable base (cents).
     * Applies exemption rules (type: 'exemption') if eligible; otherwise sums active tax rates (type: 'tax').
     */
    private async computeTaxes(
        campgroundId: string,
        taxableCents: number,
        nights: number,
        waiverSigned: boolean
    ) {
        // Exemption rules
        const exemptions = await this.prisma.taxRule.findMany({
            where: { campgroundId, type: "exemption", isActive: true }
        });

        let waiverRequired = false;
        let waiverText: string | null = null;
        for (const rule of exemptions) {
            const meetsMin = rule.minNights ? nights >= rule.minNights : true;
            const meetsMax = rule.maxNights ? nights <= rule.maxNights : true;
            if (!meetsMin || !meetsMax) continue;

            if (rule.requiresWaiver && !waiverSigned) {
                waiverRequired = true;
                waiverText = rule.waiverText ?? null;
                // keep evaluating in case another exemption applies without waiver
                continue;
            }
            // Exemption applied
            return { taxesCents: 0, waiverRequired: false, waiverText: null, exemptionApplied: true };
        }

        // Tax rules (inclusive vs exclusive)
        const taxRules = await this.prisma.taxRule.findMany({
            where: {
                campgroundId,
                type: { in: [TaxRuleType.percentage, TaxRuleType.flat] },
                isActive: true
            }
        });

        const inclusiveRules = taxRules.filter((r: any) => Boolean((r as any).inclusive));
        const exclusiveRules = taxRules.filter((r: any) => !Boolean((r as any).inclusive));

        let taxesCents = 0;
        let inclusiveTaxesCents = 0;
        let baseForExclusive = taxableCents;

        if (inclusiveRules.length) {
            const totalInclusiveRate = inclusiveRules.reduce(
                (sum: number, r: any) => sum + Number((r as any).rate || 0),
                0
            );
            if (totalInclusiveRate > 0) {
                const net = taxableCents / (1 + totalInclusiveRate);
                const inclusiveTax = taxableCents - net;
                inclusiveTaxesCents = Math.round(inclusiveTax);
                taxesCents += inclusiveTaxesCents;
                baseForExclusive = net; // apply exclusive taxes on net base
            }
        }

        for (const rule of exclusiveRules) {
            if (!rule.rate || Number(rule.rate) <= 0) continue;
            taxesCents += Math.round(baseForExclusive * Number(rule.rate));
        }

        return { taxesCents, inclusiveTaxesCents, waiverRequired, waiverText, exemptionApplied: false };
    }

    /**
     * Get available sites for a campground by slug
     */
    private isRigCompatible(
        site: { siteType: string; rigMaxLength?: number | null; siteClassRigMaxLength?: number | null },
        rigType?: string | null,
        rigLength?: number | null
    ) {
        if (!rigType && !rigLength) return true;
        const normalizedType = (rigType || "").toLowerCase();

        if (["tent", "cabin", "car", "walkin", "walk-in"].includes(normalizedType)) return true;
        if (site.siteType !== "rv") return false;
        const maxLength = site.rigMaxLength ?? site.siteClassRigMaxLength ?? null;
        if (rigLength && maxLength && rigLength > maxLength) return false;
        return true;
    }

    async getAvailability(
        slug: string,
        arrivalDate: string,
        departureDate: string,
        rigType?: string,
        rigLength?: string,
        needsAccessible?: boolean,
        previewToken?: string
    ) {
        const campground = await this.prisma.campground.findUnique({
            where: { slug },
            select: {
                id: true,
                isPublished: true,
                isBookable: true,
                isExternal: true,
                nonBookableReason: true,
                officeClosesAt: true,
                parkTimeZone: true
            }
        });

        // Check for preview token to bypass publish/bookable checks
        let isPreviewMode = false;
        if (previewToken && campground) {
            const invite = await this.prisma.onboardingInvite.findUnique({
                where: { token: previewToken },
                include: {
                    session: { include: { campground: true } },
                    campground: true
                }
            });
            const inviteCampground = invite?.session?.campground || invite?.campground;
            if (invite && inviteCampground?.id === campground.id) {
                isPreviewMode = true;
            }
        }

        if (!campground || (!campground.isPublished && !campground.isExternal && !isPreviewMode)) {
            throw new NotFoundException("Campground not found");
        }

        // In preview mode, skip the bookable check
        if (!isPreviewMode && (!campground.isBookable || campground.isExternal)) {
            throw new BadRequestException(campground.nonBookableReason || "This campground is view-only.");
        }

        if (!arrivalDate || !departureDate) {
            throw new BadRequestException("arrivalDate and departureDate are required");
        }

        const arrival = new Date(arrivalDate);
        const departure = new Date(departureDate);

        if (isNaN(arrival.valueOf()) || isNaN(departure.valueOf())) {
            throw new BadRequestException("Invalid dates");
        }
        if (departure <= arrival) {
            throw new BadRequestException("departureDate must be after arrivalDate");
        }

        // Get all active sites with their site class info (including rig length)
        const allSites = await this.prisma.site.findMany({
            where: {
                campgroundId: campground.id,
                isActive: true
            },
            include: {
                siteClass: {
                    select: {
                        id: true,
                        name: true,
                        defaultRate: true,
                        siteType: true,
                        maxOccupancy: true,
                        hookupsPower: true,
                        hookupsWater: true,
                        hookupsSewer: true,
                        petFriendly: true,
                        description: true,
                        rigMaxLength: true,
                        accessible: true,
                        sameDayBookingCutoffMinutes: true
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        // Check if this is a same-day booking and calculate cutoff
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const arrivalDay = new Date(arrival);
        arrivalDay.setHours(0, 0, 0, 0);
        const isSameDayBooking = arrivalDay.getTime() === today.getTime();

        // Parse office close time (default 17:00)
        const officeCloseTime = campground.officeClosesAt || "17:00";
        const [closeHour, closeMinute] = officeCloseTime.split(":").map(Number);

        // Get conflicting reservations
        const conflictingReservations = await this.prisma.reservation.findMany({
            where: {
                campgroundId: campground.id,
                status: { not: ReservationStatus.cancelled },
                departureDate: { gt: arrival },
                arrivalDate: { lt: departure }
            },
            select: { siteId: true }
        });

        const conflictingSiteIds = new Set(conflictingReservations.map((r: any) => r.siteId));

        // Active holds
        const now = new Date();
        const holds = await (this.prisma as any).siteHold.findMany({
            where: {
                campgroundId: campground.id,
                status: "active",
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                arrivalDate: { lt: departure },
                departureDate: { gt: arrival }
            },
            select: { siteId: true }
        });
        const holdSiteIds = new Set(holds.map((h: any) => h.siteId));

        // Get blackout dates
        const blackouts = await this.prisma.blackoutDate.findMany({
            where: {
                campgroundId: campground.id,
                startDate: { lt: departure },
                endDate: { gt: arrival }
            },
            select: { siteId: true }
        });

        // Get blocking maintenance tickets
        const maintenanceTickets = await this.prisma.maintenanceTicket.findMany({
            where: {
                campgroundId: campground.id,
                isBlocking: true,
                status: { not: 'closed' }
            },
            select: { siteId: true }
        });

        const blackedOutSiteIds = new Set<string>();
        const maintenanceSiteIds = new Set<string>();
        let campgroundBlackedOut = false;

        for (const b of blackouts) {
            if (b.siteId) {
                blackedOutSiteIds.add(b.siteId);
            } else {
                campgroundBlackedOut = true;
            }
        }

        for (const m of maintenanceTickets) {
            if (m.siteId) {
                maintenanceSiteIds.add(m.siteId);
            }
        }

        // Map all sites with status
        const rigLengthNum = rigLength ? Number(rigLength) : null;
        const sitesWithStatus = allSites.map((site: any) => {
            let status: 'available' | 'booked' | 'locked' | 'maintenance' = 'available';
            const accessibleFlag = Boolean(site.accessible || site.siteClass?.accessible);

            if (campgroundBlackedOut) {
                status = 'locked';
            } else if (maintenanceSiteIds.has(site.id)) {
                status = 'maintenance';
            } else if (blackedOutSiteIds.has(site.id)) {
                status = 'locked'; // Blackout dates treated as locked
            } else if (conflictingSiteIds.has(site.id)) {
                status = 'booked';
            } else if (
                !this.isRigCompatible(
                    {
                        siteType: site.siteType || site.siteClass?.siteType || "rv",
                        rigMaxLength: site.rigMaxLength,
                        siteClassRigMaxLength: (site as any)?.siteClass?.rigMaxLength ?? null
                    },
                    rigType,
                    Number.isFinite(rigLengthNum) ? rigLengthNum : null
                )
            ) {
                status = 'locked';
            } else if (needsAccessible && !accessibleFlag) {
                status = 'locked';
            } else if (holdSiteIds.has(site.id)) {
                status = 'locked';
            } else if (isSameDayBooking) {
                // Check same-day booking cutoff
                const siteType = site.siteType || site.siteClass?.siteType || "rv";
                let cutoffMinutes = site.siteClass?.sameDayBookingCutoffMinutes;

                // Default cutoffs: RV/tent = 0 (no cutoff), cabin/lodging = 60 minutes
                if (cutoffMinutes === null || cutoffMinutes === undefined) {
                    if (siteType === "cabin" || siteType === "lodging" || siteType === "glamping") {
                        cutoffMinutes = 60; // 1 hour before office close
                    } else {
                        cutoffMinutes = 0; // No cutoff for RV/tent
                    }
                }

                if (cutoffMinutes > 0) {
                    // Calculate cutoff time
                    const now = new Date();
                    const cutoffTime = new Date();
                    cutoffTime.setHours(closeHour, closeMinute, 0, 0);
                    cutoffTime.setMinutes(cutoffTime.getMinutes() - cutoffMinutes);

                    if (now >= cutoffTime) {
                        status = 'locked';
                    }
                }
            }

            return {
                id: site.id,
                name: site.name,
                siteNumber: site.siteNumber,
                siteType: site.siteType,
                maxOccupancy: site.maxOccupancy,
                rigMaxLength: site.rigMaxLength,
                accessible: accessibleFlag,
                siteClass: site.siteClass,
                status
            };
        });

        return sitesWithStatus;
    }

    /**
     * Get price quote for a site
     */
    async getQuote(slug: string, dto: PublicQuoteDto) {
        const campground = await this.prisma.campground.findUnique({
            where: { slug },
            select: { id: true, isPublished: true, isBookable: true, isExternal: true, nonBookableReason: true }
        });

        // Check for preview token to bypass publish/bookable checks
        let isPreviewMode = false;
        if (dto.previewToken && campground) {
            const invite = await this.prisma.onboardingInvite.findUnique({
                where: { token: dto.previewToken },
                include: {
                    session: { include: { campground: true } },
                    campground: true
                }
            });
            const inviteCampground = invite?.session?.campground || invite?.campground;
            if (invite && inviteCampground?.id === campground.id) {
                isPreviewMode = true;
            }
        }

        if (!campground || (!campground.isPublished && !campground.isExternal && !isPreviewMode)) {
            throw new NotFoundException("Campground not found");
        }

        // In preview mode, skip the bookable check
        if (!isPreviewMode && (!campground.isBookable || campground.isExternal)) {
            throw new BadRequestException(campground.nonBookableReason || "This campground is view-only.");
        }

        const arrival = new Date(dto.arrivalDate);
        const departure = new Date(dto.departureDate);

        const site = await this.prisma.site.findUnique({
            where: { id: dto.siteId },
            include: { siteClass: true }
        });

        if (!site || site.campgroundId !== campground.id) {
            throw new NotFoundException("Site not found");
        }

        const pricing = await evaluatePricingV2(
            this.prisma,
            this.pricingV2Service,
            campground.id,
            dto.siteId,
            arrival,
            departure
        );

        const nights = pricing.nights;
        let total = pricing.totalCents;
        let baseSubtotal = pricing.baseSubtotalCents;
        let rulesDelta = pricing.rulesDeltaCents;

        // Build discount candidates (promo + membership) and resolve once
        const candidates: any[] = [];
        let promotionId: string | null = null;

        if (dto.promoCode) {
            const validation = await this.promotionsService.validate({
                campgroundId: campground.id,
                code: dto.promoCode,
                subtotal: total
            });
            promotionId = validation.promotionId;

            candidates.push(
                validation.type === "percentage"
                    ? {
                        id: validation.promotionId,
                        sourceType: "promo" as const,
                        stackingRule: "non_stackable" as const,
                        priority: 200,
                        kind: "percent_off" as const,
                        value: validation.value
                    }
                    : {
                        id: validation.promotionId,
                        sourceType: "promo" as const,
                        stackingRule: "non_stackable" as const,
                        priority: 200,
                        kind: "amount_off" as const,
                        value: validation.discountCents
                    }
            );
        }

        if (dto.membershipId) {
            const membership = await this.memberships.getActiveMembershipById(dto.membershipId);
            if (membership && membership.membershipType?.discountPercent && membership.membershipType.isActive) {
                candidates.push({
                    id: membership.id,
                    sourceType: "membership" as const,
                    stackingRule: "non_stackable" as const,
                    priority: 150,
                    kind: "percent_off" as const,
                    value: membership.membershipType.discountPercent
                });
            }
        }

        const resolved = resolveDiscounts(total, candidates);
        let discountCents = resolved.totalDiscount;
        const discountCapped = resolved.capped;

        const appliedDiscounts = resolved.applied.map(d => {
            const candidate = candidates.find(c => c.id === d.id);
            return {
                id: d.id,
                type: candidate?.sourceType ?? "unknown",
                amountCents: d.appliedAmount,
                capped: resolved.capped
            };
        });

        const rejectedDiscounts = resolved.rejected.map(r => ({
            id: r.id,
            reason: r.reason
        }));

        const referral = await this.resolveReferralProgram(
            campground.id,
            dto.referralCode,
            undefined,
            Math.max(0, total - discountCents)
        );
        if (referral.program) {
            discountCents += referral.discountCents;
            appliedDiscounts.push({
                id: referral.program.id,
                type: "referral",
                amountCents: referral.discountCents,
                capped: false
            });
        }

        const totalAfterDiscount = Math.max(0, total - discountCents);

        const taxResult = await this.computeTaxes(
            campground.id,
            totalAfterDiscount,
            nights,
            dto.taxWaiverSigned ?? false
        );

        const totalWithTaxes =
            taxResult.inclusiveTaxesCents && taxResult.inclusiveTaxesCents > 0
                ? totalAfterDiscount + (taxResult.taxesCents - taxResult.inclusiveTaxesCents)
                : totalAfterDiscount + taxResult.taxesCents;

        const policyRequirements = await this.policies.evaluatePolicies(campground.id, {
            campgroundId: campground.id,
            channel: "online",
            stay: {
                nights,
                arrivalDate: arrival,
                departureDate: departure
            },
            site: {
                id: site.id,
                siteClassId: site.siteClassId,
                siteType: site.siteType,
                tags: site.tags ?? [],
                amenityTags: site.amenityTags ?? [],
                vibeTags: site.vibeTags ?? [],
                petFriendly: site.petFriendly,
                accessible: site.accessible,
                maxOccupancy: site.maxOccupancy
            },
            siteClass: site.siteClass
                ? {
                    id: site.siteClass.id,
                    siteType: site.siteClass.siteType,
                    tags: site.siteClass.tags ?? [],
                    petFriendly: site.siteClass.petFriendly,
                    accessible: site.siteClass.accessible,
                    maxOccupancy: site.siteClass.maxOccupancy,
                    minNights: site.siteClass.minNights ?? null,
                    maxNights: site.siteClass.maxNights ?? null
                }
                : undefined,
            guest: {
                adults: dto.adults ?? undefined,
                children: dto.children ?? undefined,
                partySize: (dto.adults ?? 0) + (dto.children ?? 0),
                petCount: dto.petCount ?? undefined,
                petTypes: dto.petTypes ?? [],
                stayReasonPreset: dto.stayReasonPreset ?? undefined
            }
        });

        return {
            nights,
            baseSubtotalCents: baseSubtotal,
            rulesDeltaCents: rulesDelta,
            totalCents: total,
            discountCents,
            discountCapped,
            promotionId,
            appliedDiscounts,
            rejectedDiscounts,
            totalAfterDiscountCents: totalAfterDiscount,
            taxesCents: taxResult.taxesCents,
            totalWithTaxesCents: totalWithTaxes,
            perNightCents: Math.round(totalWithTaxes / nights),
            taxWaiverRequired: taxResult.waiverRequired,
            taxWaiverText: taxResult.waiverText,
            taxExemptionApplied: taxResult.exemptionApplied,
            referralProgramId: referral.program?.id ?? null,
            referralDiscountCents: referral.discountCents ?? 0,
            referralIncentiveType: referral.type ?? null,
            referralIncentiveValue: referral.discountCents ?? 0,
            referralSource: referral.source ?? null,
            referralChannel: referral.channel ?? null,
            policyRequirements
        };
    }

    /**
     * Create a public reservation with inline guest info
     */
    async createReservation(dto: CreatePublicReservationDto) {
        const campground = await this.prisma.campground.findUnique({
            where: { slug: dto.campgroundSlug },
            select: {
                id: true,
                isPublished: true,
                isBookable: true,
                isExternal: true,
                nonBookableReason: true
            }
        });

        if (!campground || (!campground.isPublished && !campground.isExternal)) {
            throw new NotFoundException("Campground not found");
        }

        if (!campground.isBookable || campground.isExternal) {
            throw new BadRequestException(campground.nonBookableReason || "This campground is view-only.");
        }

        const arrival = new Date(dto.arrivalDate);
        const departure = new Date(dto.departureDate);

        if (isNaN(arrival.valueOf()) || isNaN(departure.valueOf())) {
            throw new BadRequestException("Invalid dates");
        }
        if (departure <= arrival) {
            throw new BadRequestException("departureDate must be after arrivalDate");
        }

        assertSiteLockValid(dto.siteLocked, dto.siteId);

        // Resolve siteId - either provided directly or find available site from class
        let siteId = dto.siteId;
        const requestedRigLength = dto.equipment?.length !== undefined && dto.equipment?.length !== null
            ? Number(dto.equipment.length)
            : null;

        if (!siteId && dto.siteClassId) {
            const availableSite = await this.findAvailableSiteInClass(
                campground.id,
                dto.siteClassId,
                arrival,
                departure,
                dto.equipment?.type,
                requestedRigLength,
                dto.needsAccessible
            );
            if (!availableSite) {
                throw new ConflictException("No available sites in the selected class for these dates");
            }
            siteId = availableSite;
        }

        if (!siteId) {
            throw new BadRequestException("Either siteId or siteClassId must be provided");
        }

        const site = await this.prisma.site.findUnique({
            where: { id: siteId },
            include: { siteClass: true }
        });

        if (!site || site.campgroundId !== campground.id) {
            throw new NotFoundException("Site not found");
        }

        const rigCompatible = this.isRigCompatible(
            {
                siteType: site.siteType || site.siteClass?.siteType || "rv",
                rigMaxLength: site.rigMaxLength,
                siteClassRigMaxLength: site.siteClass?.rigMaxLength ?? null
            },
            dto.equipment?.type,
            requestedRigLength
        );

        if (!rigCompatible) {
            throw new BadRequestException(
                site.siteType !== "rv"
                    ? "Selected site does not support this equipment type"
                    : `Rig length exceeds maximum for this site (${site.rigMaxLength ?? site.siteClass?.rigMaxLength ?? "unknown"} ft)`
            );
        }

        if (dto.needsAccessible && !(site.accessible || site.siteClass?.accessible)) {
            throw new BadRequestException("Accessible site required; please choose an ADA-accessible site.");
        }

        // Get price quote (handles promo/membership + cap)
        let quote = await this.getQuote(dto.campgroundSlug, {
            siteId: siteId,
            arrivalDate: dto.arrivalDate,
            departureDate: dto.departureDate,
            promoCode: dto.promoCode,
            membershipId: dto.membershipId,
            taxWaiverSigned: dto.taxWaiverSigned,
            referralCode: dto.referralCode,
            stayReasonPreset: dto.stayReasonPreset,
            stayReasonOther: dto.stayReasonOther
        });

        await this.policies.assertPreBookingPolicies(
            campground.id,
            {
                campgroundId: campground.id,
                channel: "online",
                stay: { nights: quote.nights, arrivalDate: arrival, departureDate: departure },
                site: {
                    id: site.id,
                    siteClassId: site.siteClassId,
                    siteType: site.siteType,
                    tags: site.tags ?? [],
                    amenityTags: site.amenityTags ?? [],
                    vibeTags: site.vibeTags ?? [],
                    petFriendly: site.petFriendly,
                    accessible: site.accessible,
                    maxOccupancy: site.maxOccupancy
                },
                siteClass: site.siteClass
                    ? {
                        id: site.siteClass.id,
                        siteType: site.siteClass.siteType,
                        tags: site.siteClass.tags ?? [],
                        petFriendly: site.siteClass.petFriendly,
                        accessible: site.siteClass.accessible,
                        maxOccupancy: site.siteClass.maxOccupancy,
                        minNights: site.siteClass.minNights ?? null,
                        maxNights: site.siteClass.maxNights ?? null
                    }
                    : undefined,
                guest: {
                    adults: dto.adults ?? undefined,
                    children: dto.children ?? undefined,
                    partySize: (dto.adults ?? 0) + (dto.children ?? 0),
                    petCount: dto.petCount ?? undefined,
                    petTypes: dto.petTypes ?? [],
                    stayReasonPreset: dto.stayReasonPreset ?? undefined
                }
            },
            dto.policyAcceptances ?? []
        );

        const subtotal = quote.totalCents;
        const discountCents = quote.discountCents ?? 0;
        const promotionId = quote.promotionId ?? null;
        const taxesCents = quote.taxesCents ?? 0;
        const totalAfterDiscount = quote.totalAfterDiscountCents ?? Math.max(0, subtotal - discountCents);
        const totalAmount = (quote.totalWithTaxesCents ?? totalAfterDiscount + taxesCents);
        const referralProgramId = (quote as any).referralProgramId ?? null;
        const referralDiscountCents = (quote as any).referralDiscountCents ?? 0;
        const referralIncentiveType = (quote as any).referralIncentiveType ?? null;
        const referralIncentiveValue = (quote as any).referralIncentiveValue ?? referralDiscountCents ?? 0;
        const referralSource = (quote as any).referralSource ?? dto.referralSource ?? null;
        const referralChannel = (quote as any).referralChannel ?? dto.referralChannel ?? null;

        // Calculate lead time (days between booking and arrival)
        const now = new Date();
        const leadTimeDays = Math.floor(
            (arrival.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return await this.locks.withLocks([siteId], async () => {
            try {
                // Validate hold if provided
                if (dto.holdId) {
                    const hold = await (this.prisma as any).siteHold.findUnique({ where: { id: dto.holdId } });
                    const now = new Date();
                    if (!hold) {
                        throw new NotFoundException("Hold not found");
                    }
                    if (hold.status !== "active" || (hold.expiresAt && hold.expiresAt <= now)) {
                        throw new ConflictException("Hold is not active");
                    }
                    if (hold.siteId !== siteId || hold.campgroundId !== campground.id) {
                        throw new ConflictException("Hold does not match site/campground");
                    }
                    if (!(hold.arrivalDate <= arrival && hold.departureDate >= departure)) {
                        throw new ConflictException("Hold does not cover requested dates");
                    }
                }

                // Check availability one more time
                const conflictCount = await this.prisma.reservation.count({
                    where: {
                        siteId: siteId,
                        status: { not: ReservationStatus.cancelled },
                        departureDate: { gt: arrival },
                        arrivalDate: { lt: departure }
                    }
                });

                if (conflictCount > 0) {
                    throw new ConflictException("Site is no longer available for the selected dates");
                }

                // Check blackout dates
                const blackoutCount = await this.prisma.blackoutDate.count({
                    where: {
                        campgroundId: campground.id,
                        OR: [{ siteId: siteId }, { siteId: null }],
                        startDate: { lt: departure },
                        endDate: { gt: arrival }
                    }
                });

                if (blackoutCount > 0) {
                    throw new ConflictException("Site is blacked out for maintenance");
                }

                // Check blocking maintenance tickets
                const maintenanceCount = await this.prisma.maintenanceTicket.count({
                    where: {
                        siteId: siteId,
                        isBlocking: true,
                        status: { not: 'closed' }
                    }
                });

                if (maintenanceCount > 0) {
                    throw new ConflictException("Site is under maintenance");
                }

                // Find or create guest
                let guest = await this.prisma.guest.findUnique({
                    where: { email: dto.guest.email }
                });

                if (!guest) {
                    guest = await this.prisma.guest.create({
                        data: {
                            primaryFirstName: dto.guest.firstName,
                            primaryLastName: dto.guest.lastName,
                            email: dto.guest.email,
                            phone: dto.guest.phone,
                            postalCode: dto.guest.zipCode
                        }
                    });
                } else {
                    // Update guest with zipCode if not already set
                    if (!guest.postalCode && dto.guest.zipCode) {
                        await this.prisma.guest.update({
                            where: { id: guest.id },
                            data: { postalCode: dto.guest.zipCode }
                        });
                    }
                }

                // Auto-detect membership by guest email if none provided and re-run quote to include it
                if (!dto.membershipId) {
                    const activeMembership = await this.memberships.getActiveMembershipByGuest(guest.id);
                    if (activeMembership) {
                        quote = await this.getQuote(dto.campgroundSlug, {
                            siteId: siteId,
                            arrivalDate: dto.arrivalDate,
                            departureDate: dto.departureDate,
                            promoCode: dto.promoCode,
                            membershipId: activeMembership.id,
                            taxWaiverSigned: dto.taxWaiverSigned,
                            referralCode: dto.referralCode,
                            stayReasonPreset: dto.stayReasonPreset,
                            stayReasonOther: dto.stayReasonOther
                        });
                    }
                }

                const depositCalc = await calculateReservationDepositV2(this.depositPoliciesService, {
                    campgroundId: campground.id,
                    siteClassId: site.siteClassId ?? null,
                    totalAmountCents: quote.totalWithTaxesCents ?? totalAmount,
                    lodgingOnlyCents: quote.baseSubtotalCents,
                    nights: quote.nights
                });
                const depositAmount = depositCalc.depositAmount;

                // Create reservation
                const reservation = await this.prisma.reservation.create({
                    data: {
                        campgroundId: campground.id,
                        siteId: siteId,
                        guestId: guest.id,
                        arrivalDate: arrival,
                        departureDate: departure,
                        adults: dto.adults,
                        children: dto.children ?? 0,
                        petCount: dto.petCount ?? 0,
                        petTypes: dto.petTypes ?? null,
                        siteLocked: dto.siteLocked ?? false,
                        status: ReservationStatus.pending,
                        totalAmount: totalAmount,
                        paidAmount: 0,
                        balanceAmount: totalAmount,
                        depositAmount,
                        depositPolicyVersion: depositCalc.depositPolicyVersion,
                        depositDueDate: new Date(),
                        paymentStatus: "unpaid",
                        baseSubtotal: quote.baseSubtotalCents,
                        feesAmount: 0,
                        taxesAmount: taxesCents,
                        discountsAmount: discountCents > 0 ? discountCents : (quote.rulesDeltaCents < 0 ? -quote.rulesDeltaCents : 0),
                        promoCode: dto.promoCode || null,
                        referralProgramId: referralProgramId,
                        referralCode: dto.referralCode || null,
                        referralSource: referralSource,
                        referralChannel: referralChannel,
                        referralIncentiveType: referralIncentiveType,
                        referralIncentiveValue: referralIncentiveValue,
                        source: "online",
                        bookedAt: now,
                        leadTimeDays: leadTimeDays,
                        additionalGuests: dto.additionalGuests ? JSON.parse(JSON.stringify(dto.additionalGuests)) : null,
                        childrenDetails: dto.childrenDetails ? JSON.parse(JSON.stringify(dto.childrenDetails)) : null,
                        taxWaiverSigned: dto.taxWaiverSigned || false,
                        taxWaiverDate: dto.taxWaiverSigned ? new Date() : null,
                        stayReasonPreset: dto.stayReasonPreset ?? null,
                        stayReasonOther: dto.stayReasonOther ?? null,
                        rigType: dto.equipment?.type,
                        rigLength: dto.equipment?.length,
                        vehiclePlate: dto.equipment?.plateNumber,
                        vehicleState: dto.equipment?.plateState
                    },
                    include: {
                        site: true,
                        guest: true,
                        campground: {
                            select: {
                                name: true,
                                slug: true,
                                cancellationPolicyType: true,
                                cancellationWindowHours: true,
                                cancellationFeeType: true,
                                cancellationFeeFlatCents: true,
                                cancellationFeePercent: true,
                                cancellationNotes: true
                            }
                        }
                    }
                });

                // Enqueue abandoned_cart playbooks (recording guest/reservation context)
                const playbooks = await (this.prisma as any).communicationPlaybook.findMany({
                    where: {
                        campgroundId: campground.id,
                        type: "abandoned_cart",
                        enabled: true,
                        templateId: { not: null }
                    }
                });
                for (const pb of playbooks as any[]) {
                    const tpl = await (this.prisma as any).communicationTemplate.findFirst({
                        where: { id: pb.templateId, status: "approved" }
                    });
                    if (!tpl) continue;
                    const scheduledAt = new Date();
                    if (pb.offsetMinutes && Number.isFinite(pb.offsetMinutes)) {
                        scheduledAt.setMinutes(scheduledAt.getMinutes() + pb.offsetMinutes);
                    }
                    await (this.prisma as any).communicationPlaybookJob.create({
                        data: {
                            playbookId: pb.id,
                            campgroundId: reservation.campgroundId,
                            reservationId: reservation.id,
                            guestId: reservation.guestId,
                            status: "pending",
                            scheduledAt
                        }
                    });
                }

                // Save guest equipment if provided
                if (dto.equipment) {
                    await this.prisma.guestEquipment.create({
                        data: {
                            guestId: guest.id,
                            type: dto.equipment.type,
                            length: dto.equipment.length,
                            plateNumber: dto.equipment.plateNumber,
                            plateState: dto.equipment.plateState,
                            make: dto.equipment.make,
                            model: dto.equipment.model
                        }
                    });
                }

                // Increment promotion usage count if promo was applied
                if (promotionId) {
                    await this.promotionsService.incrementUsage(promotionId);
                }

                try {
                    await this.policies.applyPoliciesToReservation({
                        reservation,
                        guest: reservation.guest,
                        site: reservation.site,
                        siteClass: reservation.site?.siteClass,
                        channel: "online",
                        acceptances: dto.policyAcceptances ?? []
                    });
                } catch (err) {
                    console.warn(`[Policies] Auto-apply failed for reservation ${reservation.id}:`, err);
                }

                // Send confirmation email with cancellation policy
                const cg = reservation.campground as any;
                const policyLines: string[] = [];
                if (cg.cancellationPolicyType) {
                    policyLines.push(`Policy: ${cg.cancellationPolicyType}`);
                }
                if (cg.cancellationWindowHours) {
                    policyLines.push(`Window: cancel ${cg.cancellationWindowHours}h before arrival`);
                }
                if (cg.cancellationFeeType === "flat" && cg.cancellationFeeFlatCents) {
                    policyLines.push(`Fee: $${(cg.cancellationFeeFlatCents / 100).toFixed(2)}`);
                } else if (cg.cancellationFeeType === "percent" && cg.cancellationFeePercent) {
                    policyLines.push(`Fee: ${cg.cancellationFeePercent}%`);
                } else if (cg.cancellationFeeType === "first_night") {
                    policyLines.push("Fee: first night");
                }
                if (cg.cancellationNotes) {
                    policyLines.push(cg.cancellationNotes);
                }
                const policyBlock = policyLines.length
                    ? `
                    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px;">Cancellation Policy</h3>
                        <p style="margin: 0; color: #78350f; font-size: 13px;">${policyLines.join("<br/>")}</p>
                    </div>`
                    : "";

                // Format dates nicely
                const arrivalFormatted = reservation.arrivalDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                const departureFormatted = reservation.departureDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                const nights = Math.ceil((reservation.departureDate.getTime() - reservation.arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
                const baseUrl = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE || "http://localhost:3000").replace(/\/+$/, "");

                // Check for forms that need to be completed after booking
                const afterBookingForms = await this.prisma.formTemplate.findMany({
                    where: {
                        campgroundId: dto.campgroundId,
                        isActive: true
                    },
                    select: { id: true, title: true, showAt: true, isRequired: true }
                });
                const formsToComplete = afterBookingForms.filter(f => {
                    const showAtArray = f.showAt as string[] | null;
                    return showAtArray?.includes("after_booking");
                });
                const formsBlock = formsToComplete.length > 0
                    ? `
                    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;">Forms to Complete</h3>
                        <p style="margin: 0 0 12px 0; color: #1e3a8a; font-size: 13px;">
                            Please complete the following form${formsToComplete.length > 1 ? 's' : ''} before your arrival:
                        </p>
                        <ul style="margin: 0 0 12px 0; padding-left: 20px; color: #1e3a8a; font-size: 13px;">
                            ${formsToComplete.map(f => `<li style="margin: 4px 0;">${f.title}${f.isRequired !== false ? ' <span style="color: #dc2626;">(Required)</span>' : ''}</li>`).join('')}
                        </ul>
                        <div style="text-align: center;">
                            <a href="${baseUrl}/forms/guest/${reservation.id}" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">Complete Forms Now</a>
                        </div>
                    </div>`
                    : "";

                // Send confirmation email (don't fail booking if email fails)
                try {
                    await this.emailService.sendEmail({
                        to: reservation.guest.email,
                        subject: `Reservation Confirmed: ${reservation.campground.name}`,
                        html: `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 32px; margin-bottom: 24px;">
                                        <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px;">Reservation Confirmed!</h1>
                                        <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">${reservation.campground.name}</p>
                                    </div>
                                </div>

                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
                                    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px;">
                                        Hi ${reservation.guest.primaryFirstName},<br/>
                                        Great news! Your reservation has been confirmed. Here are your stay details:
                                    </p>

                                    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Site</td>
                                                <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${reservation.site.siteNumber}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Check-in</td>
                                                <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${arrivalFormatted}<br/><span style="color: #64748b; font-size: 12px;">After 3:00 PM</span></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Check-out</td>
                                                <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${departureFormatted}<br/><span style="color: #64748b; font-size: 12px;">Before 11:00 AM</span></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b;">Duration</td>
                                                <td style="padding: 8px 0; color: #0f172a; text-align: right; font-weight: 500;">${nights} Night${nights !== 1 ? 's' : ''}</td>
                                            </tr>
                                        </table>
                                    </div>

                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="${baseUrl}/portal" style="display: inline-block; padding: 14px 28px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">View & Manage Reservation</a>
                                        <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 12px;">Access your guest portal to view details, request changes, or check in online.</p>
                                    </div>
                                </div>

                                ${policyBlock}

                                ${formsBlock}

                                <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
                                        Questions about your stay? Contact ${reservation.campground.name}
                                    </p>
                                    <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                                        Reservation ID: ${reservation.id}
                                    </p>
                                </div>
                            </div>
                        `
                    });
                } catch (emailError) {
                    console.error('[Booking] Failed to send confirmation email:', emailError);
                }

                if (dto.holdId) {
                    await (this.prisma as any).siteHold.update({
                        where: { id: dto.holdId },
                        data: { status: "released", expiresAt: new Date() }
                    });
                }

                return {
                    ...reservation,
                    appliedDiscounts: quote.appliedDiscounts ?? [],
                    rejectedDiscounts: quote.rejectedDiscounts ?? [],
                    discountCapped: quote.discountCapped ?? false
                };
            } catch (error: any) {
                console.error("Error creating reservation:", error);
                throw new BadRequestException(`Failed to create reservation: ${error.message} `);

            }
        });
    }

    /**
     * Record an abandoned cart signal
     */
    async abandonCart(payload: { campgroundId: string; email?: string; phone?: string; abandonedAt?: string }) {
        if (!payload.campgroundId) throw new BadRequestException("campgroundId required");
        let guestId: string | null = null;
        if (payload.email) {
            const existing = await this.prisma.guest.findFirst({ where: { email: payload.email } });
            if (existing) guestId = existing.id;
            else {
                const guest = await this.prisma.guest.create({
                    data: {
                        email: payload.email,
                        phone: payload.phone || "",
                        primaryFirstName: "Guest",
                        primaryLastName: "Abandoned"
                    }
                });
                guestId = guest.id;
            }
        }
        const queued = this.abandonedCarts.record({
            campgroundId: payload.campgroundId,
            email: payload.email,
            phone: payload.phone,
            abandonedAt: payload.abandonedAt
        });
        await this.enqueueAbandonedCartPlaybooks(payload.campgroundId, guestId, null);
        return { ok: true, queued };
    }

    /**
     * Find an available site in a given site class
     */
    private async findAvailableSiteInClass(
        campgroundId: string,
        siteClassId: string,
        arrival: Date,
        departure: Date,
        rigType?: string | null,
        rigLength?: number | null,
        needsAccessible?: boolean
    ): Promise<string | null> {
        // Get all sites in the class
        const sites = await this.prisma.site.findMany({
            where: {
                campgroundId,
                siteClassId,
                isActive: true
            },
            select: {
                id: true,
                siteType: true,
                rigMaxLength: true,
                accessible: true,
                siteClass: {
                    select: {
                        rigMaxLength: true,
                        accessible: true,
                        siteType: true
                    }
                }
            }
        });

        // Get conflicting reservations
        const conflictingReservations = await this.prisma.reservation.findMany({
            where: {
                campgroundId,
                siteId: { in: sites.map((s: any) => s.id) },
                status: { not: ReservationStatus.cancelled },
                departureDate: { gt: arrival },
                arrivalDate: { lt: departure }
            },
            select: { siteId: true }
        });

        const conflictingSiteIds = new Set(conflictingReservations.map((r: any) => r.siteId));

        // Find first available site
        for (const site of sites) {
            if (conflictingSiteIds.has(site.id)) continue;

            if (
                !this.isRigCompatible(
                    {
                        siteType: site.siteType || site.siteClass?.siteType || "rv",
                        rigMaxLength: site.rigMaxLength,
                        siteClassRigMaxLength: site.siteClass?.rigMaxLength ?? null
                    },
                    rigType,
                    rigLength ?? null
                )
            ) {
                continue;
            }

            const accessibleFlag = Boolean(site.accessible || site.siteClass?.accessible);
            if (needsAccessible && !accessibleFlag) {
                continue;
            }

            if (!conflictingSiteIds.has(site.id)) {
                return site.id;
            }
        }

        return null;
    }

    async kioskCheckIn(id: string, upsellTotalCents: number) {
        console.log(`[Kiosk] Check -in request for ${id}, upsell: ${upsellTotalCents} `);
        const reservation = await this.prisma.reservation.findUnique({
            where: { id },
            include: {
                guest: true,
                campground: { select: { name: true } },
                site: { select: { siteNumber: true } }
            }
        });
        if (!reservation) {
            console.error(`[Kiosk] Reservation ${id} not found`);
            throw new NotFoundException("Reservation not found");
        }

        console.log(`[Kiosk] Found reservation: ${reservation.status}, Total: ${reservation.totalAmount}, Paid: ${reservation.paidAmount} `);

        if (reservation.status === ReservationStatus.checked_in) {
            console.warn(`[Kiosk] Reservation ${id} already checked in `);
            throw new ConflictException("Reservation is already checked in");
        }

        if (reservation.idVerificationRequired) {
            const verified = await this.hasVerifiedId(reservation.id, reservation.guestId);
            if (!verified) {
                throw new ConflictException({ reason: "id_verification_required" });
            }
        }

        if (reservation.waiverRequired) {
            const signed = await this.hasSignedWaiver(reservation.id, reservation.guestId);
            if (!signed) {
                const signatureResult = await this.signatures.autoSendForReservation(reservation);
                throw new ConflictException({
                    reason: "waiver_required",
                    signingUrl: (signatureResult as any)?.signingUrl
                });
            }
        }

        const policyCompliance = await this.policies.getPendingPolicyCompliance(reservation.id);
        if (!policyCompliance.ok) {
            throw new ConflictException({
                reason: policyCompliance.reason,
                signingUrl: policyCompliance.signingUrl
            });
        }

        const newTotal = reservation.totalAmount + upsellTotalCents;
        const balanceDue = newTotal - (reservation.paidAmount || 0);

        console.log(`[Kiosk] New Total: ${newTotal}, Balance Due: ${balanceDue} `);

        // Process payment if there's a balance due
        let paymentIntentId: string | undefined;
        if (balanceDue > 0) {
            try {
                // Get the most recent successful payment to extract payment method details
                const lastPayment = await this.prisma.payment.findFirst({
                    where: {
                        reservationId: id,
                        stripePaymentIntentId: { not: null }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                if (!lastPayment?.stripePaymentIntentId) {
                    throw new BadRequestException('No payment method on file. Please provide payment details.');
                }

                // Retrieve the original payment intent to get customer and payment method
                const originalIntent = await this.stripeService.retrievePaymentIntent(lastPayment.stripePaymentIntentId);

                if (!originalIntent.customer || !originalIntent.payment_method) {
                    throw new BadRequestException('Payment method information not available. Please provide payment details.');
                }

                const customerId = typeof originalIntent.customer === 'string'
                    ? originalIntent.customer
                    : originalIntent.customer.id;
                const paymentMethodId = typeof originalIntent.payment_method === 'string'
                    ? originalIntent.payment_method
                    : originalIntent.payment_method.id;

                // Get campground's Stripe account
                const campground = await this.prisma.campground.findUnique({
                    where: { id: reservation.campgroundId },
                    select: { stripeAccountId: true, perBookingFeeCents: true }
                });

                if (!campground?.stripeAccountId) {
                    throw new BadRequestException('Payment processing not configured for this campground.');
                }

                const applicationFeeCents = campground.perBookingFeeCents || 0;

                // Charge the saved payment method
                const paymentIntent = await this.stripeService.chargeOffSession(
                    balanceDue,
                    'usd',
                    customerId,
                    paymentMethodId,
                    campground.stripeAccountId,
                    {
                        reservationId: id,
                        campgroundId: reservation.campgroundId,
                        source: 'kiosk_checkin',
                        type: 'balance_due',
                        upsellAmount: String(upsellTotalCents)
                    },
                    applicationFeeCents,
                    `kiosk-checkin-${id}-${Date.now()}`
                );

                if (paymentIntent.status !== 'succeeded') {
                    throw new BadRequestException(`Payment failed: ${paymentIntent.status}. Please contact staff for assistance.`);
                }

                paymentIntentId = paymentIntent.id;

                // Record the payment
                await this.prisma.payment.create({
                    data: {
                        campgroundId: reservation.campgroundId,
                        reservationId: id,
                        amountCents: balanceDue,
                        method: 'card',
                        direction: 'charge',
                        note: `Kiosk check-in balance charge. Upsell: $${(upsellTotalCents / 100).toFixed(2)}`,
                        stripePaymentIntentId: paymentIntent.id,
                        stripeChargeId: paymentIntent.latest_charge as string | undefined,
                        applicationFeeCents,
                        capturedAt: new Date()
                    }
                });

                console.log(`[Kiosk] Payment successful: ${paymentIntent.id}`);
            } catch (error: any) {
                console.error(`[Kiosk] Payment failed for ${id}:`, error.message);
                throw new BadRequestException(
                    `Payment processing failed: ${error.message}. Please contact staff for assistance.`
                );
            }
        }

        try {
            const updated = await this.prisma.reservation.update({
                where: { id },
                data: {
                    status: ReservationStatus.checked_in,
                    checkInAt: new Date(),
                    feesAmount: { increment: upsellTotalCents },
                    totalAmount: newTotal,
                    paidAmount: newTotal,
                    // Add a note about the upsell/kiosk check-in
                    notes: reservation.notes
                        ? `${reservation.notes} \n[Kiosk] Checked in. Upsell: $${(upsellTotalCents / 100).toFixed(2)}. ${balanceDue > 0 ? `Charged card on file (${paymentIntentId}).` : 'No balance due.'}`
                        : `[Kiosk] Checked in. Upsell: $${(upsellTotalCents / 100).toFixed(2)}. ${balanceDue > 0 ? `Charged card on file (${paymentIntentId}).` : 'No balance due.'}`
                }
            });
            console.log(`[Kiosk] Check -in successful for ${id}`);

            // Send payment receipt if there was a balance charged
            if (balanceDue > 0) {
                try {
                    await this.emailService.sendPaymentReceipt({
                        guestEmail: reservation.guest.email,
                        guestName: `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName} `,
                        campgroundName: reservation.campground.name,
                        amountCents: balanceDue,
                        paymentMethod: 'Card on file',
                        reservationId: reservation.id,
                        siteNumber: reservation.site?.siteNumber,
                        arrivalDate: reservation.arrivalDate,
                        departureDate: reservation.departureDate,
                        source: 'kiosk'
                    });
                } catch (emailError) {
                    console.error('[Kiosk] Failed to send payment receipt email:', emailError);
                }
            }

            try {
                await this.accessControl.autoGrantForReservation(id);
            } catch (err) {
                console.error(`[Kiosk] Access grant failed for ${id}: `, err);
            }

            return updated;
        } catch (e) {
            console.error(`[Kiosk] Update failed for ${id}: `, e);
            throw e;
        }
    }
    async getReservation(id: string) {
        const reservation = await this.prisma.reservation.findUnique({
            where: { id },
            include: {
                guest: {
                    select: { primaryFirstName: true, primaryLastName: true }
                },
                campground: {
                    select: { name: true, slug: true, city: true, state: true, timezone: true }
                },
                site: {
                    include: {
                        siteClass: {
                            select: { name: true, photos: true }
                        }
                    }
                }
            }
        });

        if (!reservation) {
            throw new NotFoundException("Reservation not found");
        }

        let discountsInfo = { appliedDiscounts: [] as any[], rejectedDiscounts: [] as any[], discountCapped: false };
        try {
            const membership = await this.memberships.getActiveMembershipByGuest(reservation.guestId);
            const dateOnly = (d: Date) => d.toISOString().split("T")[0];
            const quote = await this.getQuote(reservation.campground.slug, {
                siteId: reservation.siteId,
                arrivalDate: dateOnly(reservation.arrivalDate),
                departureDate: dateOnly(reservation.departureDate),
                promoCode: reservation.promoCode ?? undefined,
                membershipId: membership?.id,
                taxWaiverSigned: reservation.taxWaiverSigned ?? false
            });
            discountsInfo = {
                appliedDiscounts: quote.appliedDiscounts ?? [],
                rejectedDiscounts: quote.rejectedDiscounts ?? [],
                discountCapped: quote.discountCapped ?? false
            };
        } catch (error) {
            // Fall back silently if we cannot recompute pricing details
            console.warn("Failed to recompute reservation discounts", error);
        }

        return { ...reservation, ...discountsInfo };
    }
}
