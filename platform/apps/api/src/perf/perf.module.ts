import { Module } from "@nestjs/common";
import { PerfController } from "./perf.controller";
import { PerfService } from "./perf.service";
import { RateLimitService } from "./rate-limit.service";

@Module({
  controllers: [PerfController],
  providers: [PerfService, RateLimitService],
  exports: [PerfService, RateLimitService],
})
export class PerfModule {}
