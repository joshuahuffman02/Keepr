import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { AiAutonomousActionService } from "./ai-autonomous-action.service";
import { EmailService } from "../email/email.service";

/**
 * AI Weather Service
 *
 * Monitors weather conditions and automatically notifies guests of:
 * - Incoming storms
 * - Extreme heat/cold
 * - Flood warnings
 * - Fire risk conditions
 */

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  description: string;
  icon: string;
  alerts: WeatherAlert[];
}

interface WeatherAlert {
  event: string;
  severity: string;
  headline: string;
  description: string;
  start: Date;
  end: Date;
}

interface WeatherTriggers {
  stormWindMph: number; // Alert if wind exceeds this
  extremeHeatF: number; // Alert if temp exceeds this
  extremeColdF: number; // Alert if temp below this
  rainInches: number; // Alert if rain exceeds this in 24h
}

const DEFAULT_TRIGGERS: WeatherTriggers = {
  stormWindMph: 40,
  extremeHeatF: 100,
  extremeColdF: 32,
  rainInches: 2,
};

@Injectable()
export class AiWeatherService {
  private readonly logger = new Logger(AiWeatherService.name);
  private readonly apiBaseUrl = "https://api.openweathermap.org/data/2.5";

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AiAutopilotConfigService,
    private readonly autonomousAction: AiAutonomousActionService,
    private readonly emailService: EmailService
  ) {}

  // ==================== WEATHER DATA ====================

  /**
   * Get current weather for a campground
   */
  async getCurrentWeather(campgroundId: string): Promise<WeatherData | null> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { latitude: true, longitude: true },
    });

    if (!campground?.latitude || !campground?.longitude) {
      this.logger.warn(`No coordinates for campground ${campgroundId}`);
      return null;
    }

    const config = await this.configService.getConfig(campgroundId);
    const apiKey = config.weatherApiKey || process.env.OPENWEATHERMAP_API_KEY;

    if (!apiKey) {
      this.logger.warn("No OpenWeatherMap API key configured");
      return null;
    }

    try {
      const lat = Number(campground.latitude);
      const lon = Number(campground.longitude);

      // Get current weather
      const currentUrl = `${this.apiBaseUrl}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
      const currentResponse = await fetch(currentUrl);
      const currentData = await currentResponse.json();

      // Get alerts from One Call API
      const oneCallUrl = `${this.apiBaseUrl}/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial&exclude=minutely,hourly`;
      const oneCallResponse = await fetch(oneCallUrl);
      const oneCallData = await oneCallResponse.json();

      return {
        temp: Math.round(currentData.main?.temp || 0),
        feelsLike: Math.round(currentData.main?.feels_like || 0),
        humidity: currentData.main?.humidity || 0,
        windSpeed: Math.round(currentData.wind?.speed || 0),
        windGust: currentData.wind?.gust
          ? Math.round(currentData.wind.gust)
          : undefined,
        description: currentData.weather?.[0]?.description || "Unknown",
        icon: currentData.weather?.[0]?.icon || "01d",
        alerts: (oneCallData.alerts || []).map((a: any) => ({
          event: a.event,
          severity: a.tags?.[0] || "unknown",
          headline: a.event,
          description: a.description,
          start: new Date(a.start * 1000),
          end: new Date(a.end * 1000),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch weather: ${error}`);
      return null;
    }
  }

  /**
   * Get weather forecast for next 7 days
   */
  async getForecast(campgroundId: string): Promise<any[]> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { latitude: true, longitude: true },
    });

    if (!campground?.latitude || !campground?.longitude) {
      return [];
    }

    const config = await this.configService.getConfig(campgroundId);
    const apiKey = config.weatherApiKey || process.env.OPENWEATHERMAP_API_KEY;

    if (!apiKey) return [];

    try {
      const lat = Number(campground.latitude);
      const lon = Number(campground.longitude);

      const url = `${this.apiBaseUrl}/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial&exclude=minutely,hourly,current`;
      const response = await fetch(url);
      const data = await response.json();

      return (data.daily || []).slice(0, 7).map((day: any) => ({
        date: new Date(day.dt * 1000),
        tempHigh: Math.round(day.temp.max),
        tempLow: Math.round(day.temp.min),
        description: day.weather?.[0]?.description || "Unknown",
        icon: day.weather?.[0]?.icon || "01d",
        pop: Math.round((day.pop || 0) * 100), // Probability of precipitation
        windSpeed: Math.round(day.wind_speed || 0),
        humidity: day.humidity || 0,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch forecast: ${error}`);
      return [];
    }
  }

  // ==================== ALERTS CRUD ====================

  async getAlerts(
    campgroundId: string,
    options: {
      status?: string;
      alertType?: string;
      limit?: number;
    } = {}
  ) {
    const { status, alertType, limit = 20 } = options;

    const where: any = { campgroundId };
    if (status) where.status = status;
    if (alertType) where.alertType = alertType;

    return this.prisma.aiWeatherAlert.findMany({
      where,
      orderBy: { startTime: "desc" },
      take: limit,
    });
  }

  async getAlert(id: string) {
    const alert = await this.prisma.aiWeatherAlert.findUnique({
      where: { id },
    });
    if (!alert) throw new NotFoundException("Weather alert not found");
    return alert;
  }

  // ==================== WEATHER MONITORING ====================

  /**
   * Check weather conditions and generate alerts
   */
  async checkWeatherConditions(campgroundId: string) {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.weatherAlertsEnabled) {
      return [];
    }

    const weather = await this.getCurrentWeather(campgroundId);
    if (!weather) return [];

    const triggers = (config.weatherTriggers as WeatherTriggers) || DEFAULT_TRIGGERS;
    const alerts: any[] = [];

    // Check for extreme conditions
    if (weather.windSpeed >= triggers.stormWindMph || weather.windGust && weather.windGust >= triggers.stormWindMph) {
      alerts.push({
        alertType: "storm",
        severity: weather.windSpeed >= 60 ? "warning" : "advisory",
        title: "High Wind Advisory",
        message: this.generateWindMessage(weather),
      });
    }

    if (weather.temp >= triggers.extremeHeatF) {
      alerts.push({
        alertType: "extreme_heat",
        severity: weather.temp >= 110 ? "warning" : "advisory",
        title: "Extreme Heat Alert",
        message: this.generateHeatMessage(weather),
      });
    }

    if (weather.temp <= triggers.extremeColdF) {
      alerts.push({
        alertType: "extreme_cold",
        severity: weather.temp <= 20 ? "warning" : "advisory",
        title: "Cold Weather Alert",
        message: this.generateColdMessage(weather),
      });
    }

    // Process any weather service alerts
    for (const serviceAlert of weather.alerts) {
      alerts.push({
        alertType: this.categorizeAlert(serviceAlert.event),
        severity: this.mapSeverity(serviceAlert.severity),
        title: serviceAlert.headline,
        message: this.formatAlertMessage(serviceAlert),
        startTime: serviceAlert.start,
        endTime: serviceAlert.end,
      });
    }

    // Create alert records
    const created: any[] = [];
    for (const alert of alerts) {
      // Check for existing active alert of same type
      const existing = await this.prisma.aiWeatherAlert.findFirst({
        where: {
          campgroundId,
          alertType: alert.alertType,
          status: "active",
        },
      });

      if (existing) continue;

      // Get affected guests
      const affected = await this.getAffectedGuests(campgroundId, alert.startTime || new Date());

      const saved = await this.prisma.aiWeatherAlert.create({
        data: {
          campgroundId,
          alertType: alert.alertType,
          severity: alert.severity,
          weatherData: weather,
          title: alert.title,
          message: alert.message,
          startTime: alert.startTime || new Date(),
          endTime: alert.endTime,
          affectedDates: affected.dates,
          guestsAffected: affected.count,
          autoNotifyEnabled: true,
        },
      });

      created.push(saved);
    }

    return created;
  }

  /**
   * Get guests affected by weather event
   */
  private async getAffectedGuests(
    campgroundId: string,
    startDate: Date
  ): Promise<{ count: number; dates: Date[] }> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3); // Look at next 3 days

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "pending"] },
        arrivalDate: { lte: endDate },
        departureDate: { gte: startDate },
      },
      select: { arrivalDate: true, departureDate: true },
    });

    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return { count: reservations.length, dates };
  }

  // ==================== GUEST NOTIFICATIONS ====================

  /**
   * Send weather alert notifications to guests
   */
  async sendAlertNotifications(alertId: string) {
    const alert = await this.getAlert(alertId);

    if (!alert.autoNotifyEnabled) {
      throw new BadRequestException("Auto-notify is disabled for this alert");
    }

    // Get affected reservations
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId: alert.campgroundId,
        status: { in: ["confirmed", "pending"] },
        arrivalDate: { lte: alert.endTime || alert.startTime },
        departureDate: { gte: alert.startTime },
      },
      include: {
        guest: true,
        campground: { select: { name: true, phone: true } },
      },
    });

    let sent = 0;
    const notifications: any[] = [];

    for (const res of reservations) {
      const email = res.guest?.email;
      if (!email) continue;

      try {
        await this.emailService.sendEmail({
          to: email,
          subject: `Weather Alert: ${alert.title}`,
          html: this.generateAlertEmailHtml(alert, res),
          guestId: res.guestId || undefined,
          reservationId: res.id,
          campgroundId: alert.campgroundId,
        });

        notifications.push({
          guestId: res.guestId,
          reservationId: res.id,
          email,
          sentAt: new Date(),
        });
        sent++;
      } catch (error) {
        this.logger.error(`Failed to send weather alert to ${email}: ${error}`);
      }
    }

    // Update alert with notification log
    await this.prisma.aiWeatherAlert.update({
      where: { id: alertId },
      data: {
        guestsNotified: sent,
        notificationsSent: notifications,
      },
    });

    // Log autonomous action
    await this.autonomousAction.logAction({
      campgroundId: alert.campgroundId,
      actionType: "weather_alert_sent",
      entityType: "weather_alert",
      entityId: alertId,
      description: `Sent weather alert to ${sent} guests`,
      details: {
        alertType: alert.alertType,
        severity: alert.severity,
        guestsNotified: sent,
      },
    });

    this.logger.log(`Sent weather alert ${alertId} to ${sent} guests`);

    return { sent, total: reservations.length };
  }

  /**
   * Generate email HTML for weather alert
   */
  private generateAlertEmailHtml(alert: any, reservation: any): string {
    const campgroundName = reservation.campground?.name || "the campground";
    const campgroundPhone = reservation.campground?.phone || "";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-box { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .alert-title { color: #92400E; font-size: 18px; font-weight: bold; margin: 0 0 10px 0; }
    .alert-message { color: #78350F; line-height: 1.6; }
    .stay-info { background: #F1F5F9; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .footer { color: #64748B; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="alert-box">
    <p class="alert-title">${alert.title}</p>
    <p class="alert-message">${alert.message}</p>
  </div>

  <div class="stay-info">
    <p><strong>Your Reservation:</strong></p>
    <p>Check-in: ${reservation.arrivalDate.toLocaleDateString()}</p>
    <p>Check-out: ${reservation.departureDate.toLocaleDateString()}</p>
  </div>

  <p>We're sending this alert to help you prepare for your stay. Please take appropriate precautions and feel free to contact us if you have any questions or concerns.</p>

  ${campgroundPhone ? `<p><strong>Contact us:</strong> ${campgroundPhone}</p>` : ""}

  <div class="footer">
    <p>This automated alert was sent by ${campgroundName} to keep you informed about conditions that may affect your stay.</p>
  </div>
</body>
</html>`;
  }

  // ==================== HELPER METHODS ====================

  private generateWindMessage(weather: WeatherData): string {
    const speed = weather.windGust || weather.windSpeed;
    return `Current wind speeds are reaching ${speed} mph. Please secure loose items at your campsite and avoid activities near trees. If conditions worsen, seek shelter in your vehicle or a sturdy building.`;
  }

  private generateHeatMessage(weather: WeatherData): string {
    return `Temperatures are reaching ${weather.temp}°F (feels like ${weather.feelsLike}°F). Stay hydrated, seek shade during peak hours, and watch for signs of heat exhaustion. Check on pets and elderly family members frequently.`;
  }

  private generateColdMessage(weather: WeatherData): string {
    return `Temperatures have dropped to ${weather.temp}°F (feels like ${weather.feelsLike}°F). Ensure you have adequate heating, dress in layers, and protect water connections from freezing. Limit time outdoors and watch for signs of hypothermia.`;
  }

  private categorizeAlert(event: string): string {
    const lower = event.toLowerCase();
    if (lower.includes("wind") || lower.includes("storm") || lower.includes("thunder")) {
      return "storm";
    }
    if (lower.includes("heat")) return "extreme_heat";
    if (lower.includes("cold") || lower.includes("freeze") || lower.includes("frost")) {
      return "extreme_cold";
    }
    if (lower.includes("flood")) return "flood";
    if (lower.includes("fire")) return "fire_risk";
    if (lower.includes("snow") || lower.includes("ice") || lower.includes("winter")) {
      return "snow";
    }
    return "storm";
  }

  private mapSeverity(severity: string): string {
    const lower = severity.toLowerCase();
    if (lower.includes("extreme") || lower.includes("emergency")) return "emergency";
    if (lower.includes("severe") || lower.includes("warning")) return "warning";
    if (lower.includes("watch")) return "watch";
    return "advisory";
  }

  private formatAlertMessage(alert: WeatherAlert): string {
    return alert.description.substring(0, 500);
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Check weather every 2 hours
   */
  @Cron("0 */2 * * *")
  async runWeatherCheck() {
    this.logger.log("Starting scheduled weather check...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { weatherAlertsEnabled: true },
      select: { campgroundId: true },
    });

    let checked = 0;
    let alertsCreated = 0;

    for (const config of configs) {
      try {
        const alerts = await this.checkWeatherConditions(config.campgroundId);
        alertsCreated += alerts.length;

        // Auto-send notifications for new high-severity alerts
        for (const alert of alerts) {
          if (["warning", "emergency"].includes(alert.severity)) {
            await this.sendAlertNotifications(alert.id);
          }
        }

        checked++;
      } catch (error) {
        this.logger.error(
          `Failed to check weather for ${config.campgroundId}: ${error}`
        );
      }
    }

    if (alertsCreated > 0) {
      this.logger.log(
        `Weather check complete: ${checked} campgrounds, ${alertsCreated} alerts created`
      );
    }
  }

  /**
   * Expire old alerts (runs daily at midnight)
   */
  @Cron("0 0 * * *")
  async expireOldAlerts() {
    const result = await this.prisma.aiWeatherAlert.updateMany({
      where: {
        status: "active",
        OR: [
          { endTime: { lt: new Date() } },
          {
            endTime: null,
            startTime: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        ],
      },
      data: { status: "expired" },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} weather alerts`);
    }
  }

  // ==================== SUMMARY ====================

  async getWeatherSummary(campgroundId: string) {
    const current = await this.getCurrentWeather(campgroundId);
    const activeAlerts = await this.prisma.aiWeatherAlert.count({
      where: { campgroundId, status: "active" },
    });

    return {
      current,
      activeAlerts,
    };
  }
}
