"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  CloudSun,
  ArrowLeft,
  Sparkles,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  Wind,
  Thermometer,
  Droplets,
  AlertTriangle,
  Bell,
  Settings
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

type WeatherData = NonNullable<Awaited<ReturnType<typeof apiClient.getCurrentWeather>>>;
type ForecastDay = Awaited<ReturnType<typeof apiClient.getWeatherForecast>>[number];
type WeatherAlert = Awaited<ReturnType<typeof apiClient.getWeatherAlerts>>[number];
type AutopilotConfig = Awaited<ReturnType<typeof apiClient.getAutopilotConfig>>;

function getWeatherIcon(icon: string) {
  if (icon.includes("rain") || icon.includes("drizzle")) return CloudRain;
  if (icon.includes("snow")) return CloudSnow;
  if (icon.includes("thunder")) return CloudLightning;
  if (icon.includes("cloud")) return Cloud;
  return Sun;
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "warning":
      return "bg-status-error text-status-error-foreground";
    case "watch":
      return "bg-status-warning text-status-warning-foreground";
    case "advisory":
      return "bg-status-info text-status-info-foreground";
    default:
      return "bg-status-info text-status-info-foreground";
  }
}

export default function AIWeatherPage() {
  // Get campground
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgrounds[0];

  // Get current weather
  const { data: weather, isLoading: loadingWeather } = useQuery<WeatherData | null>({
    queryKey: ["current-weather", campground?.id],
    queryFn: () => apiClient.getCurrentWeather(campground!.id),
    enabled: !!campground?.id,
    refetchInterval: 300000, // 5 minutes
  });

  // Get weather forecast
  const { data: forecast = [], isLoading: loadingForecast } = useQuery<ForecastDay[]>({
    queryKey: ["weather-forecast", campground?.id],
    queryFn: () => apiClient.getWeatherForecast(campground!.id),
    enabled: !!campground?.id,
  });

  // Get weather alerts
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery<WeatherAlert[]>({
    queryKey: ["weather-alerts", campground?.id],
    queryFn: () => apiClient.getWeatherAlerts(campground!.id),
    enabled: !!campground?.id,
  });

  // Get autopilot config
  const { data: autopilotConfig } = useQuery<AutopilotConfig>({
    queryKey: ["ai-autopilot-config", campground?.id],
    queryFn: () => apiClient.getAutopilotConfig(campground!.id),
    enabled: !!campground?.id,
  });

  const activeAlerts = alerts.filter((alert) => alert.status === "active");
  const WeatherIcon = weather ? getWeatherIcon(weather.icon || "") : CloudSun;

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <CloudSun className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">Select a campground to view weather</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <Link href="/ai">
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-status-info-bg text-status-info-text border border-status-info-border shadow-sm">
              <CloudSun className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Weather Alerts</h1>
              <p className="text-sm text-muted-foreground">
                Automated weather monitoring and guest notifications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={autopilotConfig?.weatherAlertsEnabled ? "default" : "secondary"}>
              {autopilotConfig?.weatherAlertsEnabled ? "Active" : "Disabled"}
            </Badge>
            <Link href="/ai/settings">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Configure
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.05 }}
            className="space-y-3"
          >
            {activeAlerts.map((alert) => (
              <Card key={alert.id} className="border-status-warning-border bg-status-warning-bg">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-status-warning-text mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-status-warning-text">
                          {alert.title}
                        </span>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-status-warning-text">{alert.message}</p>
                      {alert.guestsNotified > 0 && (
                        <p className="text-xs text-status-warning-text mt-2">
                          <Bell className="h-3 w-3 inline mr-1" />
                          {alert.guestsNotified} guests notified
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Current Weather */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Current Conditions</CardTitle>
              <CardDescription>
                {weather?.updatedAt
                  ? `Updated ${formatDistanceToNow(new Date(weather.updatedAt), { addSuffix: true })}`
                  : "Current weather conditions"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingWeather ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : weather ? (
                <div className="flex flex-col md:flex-row md:items-center gap-8">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-2xl bg-status-info-bg border border-status-info-border flex items-center justify-center">
                      <WeatherIcon className="h-10 w-10 text-status-info-text" />
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-foreground">
                        {Math.round(weather?.temp ?? weather?.temperature ?? 0)}°F
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {weather?.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 md:ml-auto">
                    <div className="text-center">
                      <Thermometer className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-medium">{Math.round(weather?.feelsLike ?? 0)}°F</p>
                      <p className="text-xs text-muted-foreground">Feels Like</p>
                    </div>
                    <div className="text-center">
                      <Droplets className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-medium">{weather?.humidity ?? 0}%</p>
                      <p className="text-xs text-muted-foreground">Humidity</p>
                    </div>
                    <div className="text-center">
                      <Wind className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-medium">{Math.round(weather?.windSpeed ?? 0)} mph</p>
                      <p className="text-xs text-muted-foreground">Wind</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CloudSun className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Weather data unavailable</p>
                  <p className="text-sm text-muted-foreground mt-1">Configure weather API in settings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Forecast */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>5-Day Forecast</CardTitle>
              <CardDescription>AI will auto-notify guests of severe weather</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingForecast ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : Array.isArray(forecast) && forecast.length > 0 ? (
                <div className="grid grid-cols-5 gap-4">
                  {forecast.slice(0, 5).map((day, i) => {
                    const DayIcon = getWeatherIcon(day.icon || "");
                    const high = day.tempHigh ?? 0;
                    const low = day.tempLow ?? 0;
                    return (
                      <div key={i} className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {i === 0 ? "Today" : format(new Date(day.date), "EEE")}
                        </p>
                        <DayIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="font-bold text-foreground">{Math.round(high)}°</p>
                        <p className="text-sm text-muted-foreground">{Math.round(low)}°</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Forecast unavailable</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Alert History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Past weather alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAlerts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No weather alerts yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.slice(0, 10).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <CloudLightning className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {alert.guestsNotified} guests notified
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={alert.status === "active" ? "default" : "secondary"}>
                          {alert.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.startTime && formatDistanceToNow(new Date(alert.startTime), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardShell>
  );
}
