import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { ReviewsService } from "./reviews.service";
import { CreateReviewRequestDto } from "./dto/create-review-request.dto";
import { SubmitReviewDto } from "./dto/submit-review.dto";
import { ModerateReviewDto } from "./dto/moderate-review.dto";
import { VoteReviewDto } from "./dto/vote-review.dto";
import { ReplyReviewDto } from "./dto/reply-review.dto";

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.front_desk)
  @Post("reviews/requests")
  createRequest(@Body() dto: CreateReviewRequestDto) {
    return this.reviewsService.createRequest(dto);
  }

  @Post("reviews/submit")
  submit(@Body() dto: SubmitReviewDto, @Req() req: Request) {
    return this.reviewsService.submitReview(dto, req.ip);
  }

  @Get("reviews/public")
  listPublic(@Query("campgroundId") campgroundId: string) {
    return this.reviewsService.listPublic(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.front_desk, UserRole.readonly)
  @Get("reviews")
  listAdmin(@Query("campgroundId") campgroundId: string, @Query("status") status?: string) {
    return this.reviewsService.listAdmin(campgroundId, status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Post("reviews/moderate")
  moderate(@Body() dto: ModerateReviewDto, @Req() req: Request) {
    const actorId = req.user?.userId;
    return this.reviewsService.moderate(dto, actorId);
  }

  @Post("reviews/vote")
  vote(@Body() dto: VoteReviewDto, @Req() req: Request) {
    const guestId = req.user?.guestId ?? undefined;
    return this.reviewsService.vote(dto, req.ip, guestId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Post("reviews/reply")
  reply(@Body() dto: ReplyReviewDto) {
    return this.reviewsService.reply(dto);
  }
}

