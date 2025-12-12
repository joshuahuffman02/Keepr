import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) { }

  @Get("health")
  getLiveness() {
    return this.health.liveness();
  }

  @Get("healthz")
  async getHealthz() {
    const result = await this.health.liveness();
    if (!result.ok) {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  @Get("ready")
  async getReady() {
    const result = await this.health.readiness();
    if (!result.ok) {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  @Get("readyz")
  async getReadyz() {
    const result = await this.health.readiness();
    if (!result.ok) {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}

