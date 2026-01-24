import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { ReviewsService } from "./reviews.service";
import { CreateReviewRequestDto } from "./dto/create-review-request.dto";
import { SubmitReviewDto } from "./dto/submit-review.dto";
import { ModerateReviewDto } from "./dto/moderate-review.dto";
import { VoteReviewDto } from "./dto/vote-review.dto";
import { ReplyReviewDto } from "./dto/reply-review.dto";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";
import type { Guest } from "@prisma/client";

type ReviewsRequest = Request & { user?: AuthUser | Guest };

const isAuthUser = (user: AuthUser | Guest): user is AuthUser => "platformRole" in user;

const isGuest = (user: AuthUser | Guest): user is Guest => !isAuthUser(user);

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  private requireUserId(req: ReviewsRequest): string {
    const user = req.user;
    if (!user || !isAuthUser(user)) {
      throw new BadRequestException("User authentication required");
    }
    return user.id;
  }

  private getGuestId(req: ReviewsRequest): string | undefined {
    const user = req.user;
    if (!user || !isGuest(user)) return undefined;
    return user.id;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.front_desk)
  @Post("reviews/requests")
  createRequest(@Body() dto: CreateReviewRequestDto) {
    return this.reviewsService.createRequest(dto);
  }

  @Post("reviews/submit")
  submit(@Body() dto: SubmitReviewDto, @Req() req: ReviewsRequest) {
    return this.reviewsService.submitReview(dto, req.ip);
  }

  @Get("reviews/public")
  listPublic(@Query("campgroundId") campgroundId: string) {
    return this.reviewsService.listPublic(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.marketing,
    UserRole.front_desk,
    UserRole.readonly,
  )
  @Get("reviews")
  listAdmin(@Query("campgroundId") campgroundId: string, @Query("status") status?: string) {
    return this.reviewsService.listAdmin(campgroundId, status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Post("reviews/moderate")
  moderate(@Body() dto: ModerateReviewDto, @Req() req: ReviewsRequest) {
    const actorId = this.requireUserId(req);
    return this.reviewsService.moderate(dto, actorId);
  }

  @Post("reviews/vote")
  vote(@Body() dto: VoteReviewDto, @Req() req: ReviewsRequest) {
    const guestId = this.getGuestId(req);
    return this.reviewsService.vote(dto, req.ip, guestId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Post("reviews/reply")
  reply(@Body() dto: ReplyReviewDto) {
    return this.reviewsService.reply(dto);
  }
}
