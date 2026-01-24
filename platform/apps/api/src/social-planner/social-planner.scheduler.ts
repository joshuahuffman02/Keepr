import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SocialPlannerService } from "./social-planner.service";

@Injectable()
export class SocialPlannerScheduler {
  private readonly logger = new Logger(SocialPlannerScheduler.name);

  constructor(private readonly planner: SocialPlannerService) {}

  // Every Monday at 7 AM server time
  @Cron("0 7 * * 1")
  async generateWeeklyIdeas() {
    this.logger.log("Generating weekly social planner ideas for all campgrounds");
    await this.planner.generateWeeklyIdeasForAllCampgrounds();
  }
}
