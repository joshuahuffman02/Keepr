import { Module } from "@nestjs/common";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailModule } from "../email/email.module";
import { GamificationModule } from "../gamification/gamification.module";

@Module({
  imports: [EmailModule, GamificationModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
