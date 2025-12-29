import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AnomaliesService } from "./anomalies.service";
import { AnomalyCheckDto } from "./dto/anomaly-check.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("anomalies")
@UseGuards(JwtAuthGuard)
export class AnomaliesController {
    constructor(private readonly service: AnomaliesService) { }

    @Get("check")
    async check(@Query() query: AnomalyCheckDto) {
        return this.service.check(query);
    }
}
