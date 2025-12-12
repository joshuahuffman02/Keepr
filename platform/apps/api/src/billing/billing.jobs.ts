import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BillingService } from "./billing.service";

@Injectable()
export class BillingJobs {
  private readonly logger = new Logger(BillingJobs.name);

  constructor(private readonly billing: BillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateInvoices() {
    this.logger.log("[BillingJobs] running daily invoice generation");
    await this.billing.generateCyclesAndInvoices();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async applyLateFees() {
    this.logger.log("[BillingJobs] applying late fees");
    await this.billing.applyLateFeesForOverdue();
  }
}
