import { Controller, Get, HttpException, HttpStatus, UseGuards } from "@nestjs/common";
import { HealthService } from "./health.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) { }

  @Get("health")
  getLiveness() {
    return this.health.liveness();
  }

  /**
   * Check which services are configured (for beta launch verification)
   * SECURITY: Requires platform_admin role - exposes configuration info
   */
  @Get("health/services")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("platform_admin")
  getServicesStatus() {
    return {
      timestamp: new Date().toISOString(),
      services: {
        stripe: {
          configured: !!process.env.STRIPE_SECRET_KEY,
          // SECURITY: Don't reveal live vs test mode to attackers
          webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        },
        email: {
          resend: !!process.env.RESEND_API_KEY,
          postmark: !!process.env.POSTMARK_SERVER_TOKEN,
          smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
        },
        sms: {
          twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
          phoneConfigured: !!process.env.TWILIO_PHONE_NUMBER,
        },
        storage: {
          s3Configured: !!(process.env.UPLOADS_S3_BUCKET && process.env.UPLOADS_S3_ACCESS_KEY),
          cdnConfigured: !!process.env.UPLOADS_CDN_BASE,
        },
        monitoring: {
          sentry: !!process.env.SENTRY_DSN,
          slackAlerts: !!process.env.SLACK_WEBHOOK_URL,
          pagerduty: !!process.env.PAGERDUTY_ROUTING_KEY,
        },
        auth: {
          jwtSecret: !!process.env.JWT_SECRET,
        },
        integrations: {
          quickbooks: !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET),
          openai: !!process.env.OPENAI_API_KEY,
        },
      },
    };
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

