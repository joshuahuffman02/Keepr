import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes, createHash, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { CreateReviewRequestDto } from "./dto/create-review-request.dto";
import { SubmitReviewDto } from "./dto/submit-review.dto";
import { ModerateReviewDto } from "./dto/moderate-review.dto";
import { VoteReviewDto } from "./dto/vote-review.dto";
import { ReplyReviewDto } from "./dto/reply-review.dto";
import { GamificationService } from "../gamification/gamification.service";
import {
  GamificationEventCategory,
  ReviewModerationStatus,
  ReviewStatus,
  ReviewVoteValue,
} from "@prisma/client";

function baseAppUrl() {
  const url =
    process.env.PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.campreserv.com";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

type GuestContact = {
  email?: string | null;
  phone?: string | null;
  name?: string;
};

const REVIEW_STATUS_MAP: Record<string, ReviewStatus> = {
  approved: ReviewStatus.approved,
  rejected: ReviewStatus.rejected,
  pending: ReviewStatus.pending,
  removed: ReviewStatus.removed,
};

const REVIEW_VOTE_MAP: Record<string, ReviewVoteValue> = {
  helpful: ReviewVoteValue.helpful,
  not_helpful: ReviewVoteValue.not_helpful,
};

const REVIEW_MODERATION_STATUS_MAP: Record<ReviewStatus, ReviewModerationStatus> = {
  approved: ReviewModerationStatus.approved,
  rejected: ReviewModerationStatus.rejected,
  pending: ReviewModerationStatus.pending,
  removed: ReviewModerationStatus.rejected,
};

const getReviewStatus = (status?: string) => {
  if (!status) return undefined;
  return REVIEW_STATUS_MAP[status];
};

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly gamification: GamificationService,
  ) {}

  private generateToken() {
    return randomBytes(24).toString("hex");
  }

  private hashIp(ip?: string) {
    if (!ip) return null;
    return createHash("sha256").update(ip).digest("hex");
  }

  private async resolveGuestContact(
    guestId?: string,
    reservationId?: string,
    email?: string,
    phone?: string,
  ): Promise<GuestContact> {
    if (guestId) {
      const guest = await this.prisma.guest.findUnique({
        where: { id: guestId },
        select: { email: true, phone: true, primaryFirstName: true, primaryLastName: true },
      });
      if (guest) {
        return {
          email: email ?? guest.email,
          phone: phone ?? guest.phone,
          name: `${guest.primaryFirstName} ${guest.primaryLastName}`,
        };
      }
    }
    if (reservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          Guest: {
            select: { email: true, phone: true, primaryFirstName: true, primaryLastName: true },
          },
        },
      });
      if (reservation?.Guest) {
        const g = reservation.Guest;
        return {
          email: email ?? g.email,
          phone: phone ?? g.phone,
          name: `${g.primaryFirstName} ${g.primaryLastName}`,
        };
      }
    }
    return { email, phone, name: undefined };
  }

  async createRequest(dto: CreateReviewRequestDto) {
    const contact = await this.resolveGuestContact(
      dto.guestId,
      dto.reservationId,
      dto.email,
      dto.phone,
    );
    const token = this.generateToken();
    const expiresAt = dto.expireDays
      ? new Date(Date.now() + dto.expireDays * 24 * 60 * 60 * 1000)
      : null;
    const link = `${baseAppUrl()}/reviews/submit?token=${token}`;

    const request = await this.prisma.reviewRequest.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        organizationId: dto.organizationId ?? null,
        guestId: dto.guestId ?? null,
        reservationId: dto.reservationId ?? null,
        channel: dto.channel,
        status: dto.channel === "email" ? "sent" : "queued",
        token,
        expiresAt,
        sentAt: dto.channel === "email" ? new Date() : null,
        metadata: { link },
      },
    });

    if (dto.channel === "email") {
      if (!contact.email) throw new BadRequestException("Email required for email channel");
      const subject = "Share your experience with us";
      const guestName = contact.name || "there";
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">Hi ${guestName},</h2>
          <p style="color: #475569; line-height: 1.6;">We hope you enjoyed your stay. Would you leave a quick review to help other guests?</p>
          <p style="margin: 16px 0;">
            <a href="${link}" style="background: #22c55e; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">Leave a review</a>
          </p>
          <p style="color: #94a3b8; font-size: 12px;">This link is unique to you and may expire.</p>
        </div>
      `;
      await this.emailService.sendEmail({
        to: contact.email,
        subject,
        html,
        guestId: dto.guestId,
        reservationId: dto.reservationId,
        campgroundId: dto.campgroundId,
      });
    }

    return request;
  }

  async submitReview(dto: SubmitReviewDto, ip?: string) {
    const request = await this.prisma.reviewRequest.findUnique({
      where: { token: dto.token },
      include: { Review: true },
    });
    if (!request) throw new NotFoundException("Review request not found");
    if (request.expiresAt && request.expiresAt < new Date()) {
      await this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: "expired" },
      });
      throw new BadRequestException("Review link expired");
    }
    if (request.Review) throw new BadRequestException("Review already submitted");

    const review = await this.prisma.review.create({
      data: {
        id: randomUUID(),
        campgroundId: request.campgroundId,
        organizationId: request.organizationId ?? null,
        guestId: request.guestId ?? null,
        reservationId: request.reservationId ?? null,
        requestId: request.id,
        rating: dto.rating,
        title: dto.title ?? null,
        body: dto.body ?? null,
        photos: dto.photos ?? [],
        tags: dto.tags ?? [],
        source: request.channel === "kiosk" ? "kiosk" : request.channel === "sms" ? "sms" : "email",
        status: "approved",
        exposure: "public",
      },
    });

    await this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: { status: "responded", respondedAt: new Date() },
    });

    await this.prisma.reviewModeration.create({
      data: {
        id: randomUUID(),
        reviewId: review.id,
        status: "pending",
        reasons: [],
      },
    });

    await this.prisma.reviewVote
      .create({
        data: {
          id: randomUUID(),
          reviewId: review.id,
          campgroundId: review.campgroundId,
          ipHash: this.hashIp(ip),
          value: ReviewVoteValue.helpful,
        },
      })
      .catch(() => undefined);

    // Gamification: positive review mention → award creator
    if (review.reservationId && review.rating >= 4) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: review.reservationId },
        select: { id: true, campgroundId: true, createdBy: true },
      });
      if (reservation?.createdBy) {
        const membership = await this.prisma.campgroundMembership.findFirst({
          where: { userId: reservation.createdBy, campgroundId: reservation.campgroundId },
        });
        await this.gamification.recordEvent({
          campgroundId: reservation.campgroundId,
          userId: reservation.createdBy,
          membershipId: membership?.id,
          category: GamificationEventCategory.review_mention,
          reason: "Positive guest review",
          sourceType: "review",
          sourceId: review.id,
          eventKey: `review:${review.id}:positive`,
        });
      }
    }

    return review;
  }

  async listPublic(campgroundId: string) {
    return this.prisma.review
      .findMany({
        where: { campgroundId, status: { not: "removed" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          photos: true,
          tags: true,
          createdAt: true,
          ReviewReply: true,
        },
      })
      .then((reviews) =>
        reviews.map(({ ReviewReply, ...rest }) => ({ ...rest, replies: ReviewReply })),
      );
  }

  async listAdmin(campgroundId: string, status?: string) {
    const statusFilter = getReviewStatus(status);
    return this.prisma.review
      .findMany({
        where: { campgroundId, ...(statusFilter ? { status: statusFilter } : {}) },
        orderBy: { createdAt: "desc" },
        include: {
          ReviewModeration: true,
          Guest: { select: { primaryFirstName: true, primaryLastName: true, email: true } },
          Reservation: { select: { id: true } },
          ReviewReply: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              authorType: true,
              authorId: true,
              body: true,
              createdAt: true,
            },
          },
        },
      })
      .then((reviews) =>
        reviews.map(({ ReviewModeration, ReviewReply, Guest, Reservation, ...rest }) => ({
          ...rest,
          moderation: ReviewModeration,
          replies: ReviewReply,
          guest: Guest,
          reservation: Reservation,
        })),
      );
  }

  async moderate(dto: ModerateReviewDto, actorId?: string) {
    const prisma = this.prisma;
    const review = await prisma.review.findUnique({ where: { id: dto.reviewId } });
    if (!review) throw new NotFoundException("Review not found");
    const status = REVIEW_STATUS_MAP[dto.status];
    const moderationStatus = REVIEW_MODERATION_STATUS_MAP[status];
    await prisma.review.update({
      where: { id: dto.reviewId },
      data: { status, exposure: dto.status === "approved" ? "public" : review.exposure },
    });
    await prisma.reviewModeration.upsert({
      where: { reviewId: dto.reviewId },
      create: {
        id: randomUUID(),
        reviewId: dto.reviewId,
        status: moderationStatus,
        reasons: dto.reasons ?? [],
        decidedBy: actorId ?? null,
        decidedAt: new Date(),
        notes: dto.notes ?? null,
      },
      update: {
        status: moderationStatus,
        reasons: dto.reasons ?? [],
        decidedBy: actorId ?? null,
        decidedAt: new Date(),
        notes: dto.notes ?? null,
      },
    });
    return { ok: true };
  }

  async vote(dto: VoteReviewDto, ip?: string, guestId?: string) {
    const review = await this.prisma.review.findUnique({ where: { id: dto.reviewId } });
    if (!review) throw new NotFoundException("Review not found");
    const ipHash = this.hashIp(ip ?? "");
    const value = REVIEW_VOTE_MAP[dto.value];
    if (guestId) {
      const vote = await this.prisma.reviewVote.upsert({
        where: { reviewId_guestId: { reviewId: dto.reviewId, guestId } },
        update: { value, ipHash },
        create: {
          id: randomUUID(),
          reviewId: dto.reviewId,
          guestId,
          ipHash,
          campgroundId: review.campgroundId,
          value,
        },
      });
      return vote;
    }
    const existing = ipHash
      ? await this.prisma.reviewVote.findFirst({ where: { reviewId: dto.reviewId, ipHash } })
      : null;
    if (existing) {
      return this.prisma.reviewVote.update({
        where: { id: existing.id },
        data: { value, ipHash },
      });
    }
    return this.prisma.reviewVote.create({
      data: {
        id: randomUUID(),
        reviewId: dto.reviewId,
        guestId: null,
        ipHash,
        campgroundId: review.campgroundId,
        value,
      },
    });
  }

  async reply(dto: ReplyReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: dto.reviewId } });
    if (!review) throw new NotFoundException("Review not found");
    return this.prisma.reviewReply.create({
      data: {
        id: randomUUID(),
        reviewId: dto.reviewId,
        authorType: dto.authorType,
        authorId: dto.authorId ?? null,
        body: dto.body,
      },
    });
  }
}
