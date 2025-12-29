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

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

type WeatherData = {
  temp?: number;
  temperature?: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  description: string;
  icon: string;
  updatedAt?: string;
  alerts?: Array<{
    event: string;
    severity: string;
    headline: string;
    start: string;
    end: string;
  }>;
};

type WeatherAlert = {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  guestsAffected?: number;
  guestsNotified: number;
  startTime: string;
  status: string;
  createdAt?: string;
};

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
      return "bg-red-500 text-white";
    case "watch":
      return "bg-orange-500 text-white";
    case "advisory":
      return "bg-amber-500 text-white";
    default:
      return "bg-blue-500 text-white";
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
  const { data: weather, isLoading: loadingWeather } = useQuery({
    queryKey: ["current-weather", campground?.id],
    queryFn: () => apiClient.getCurrentWeather(campground!.id),
    enabled: !!campground?.id,
    refetchInterval: 300000, // 5 minutes
  });

  // Get weather forecast
  const { data: forecast = [], isLoading: loadingForecast } = useQuery({
    queryKey: ["weather-forecast", campground?.id],
    queryFn: () => apiClient.getWeatherForecast(campground!.id),
    enabled: !!campground?.id,
  });

  // Get weather alerts
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ["weather-alerts", campground?.id],
    queryFn: () => apiClient.getWeatherAlerts(campground!.id),
    enabled: !!campground?.id,
  });

  // Get autopilot config
  const { data: autopilotConfig } = useQuery({
    queryKey: ["ai-autopilot-config", campground?.id],
    queryFn: () => apiClient.getAutopilotConfig(campground!.id),
    enabled: !!campground?.id,
  });

  const activeAlerts = (alerts as WeatherAlert[]).filter(a => a.status === "active");
  const WeatherIcon = weather ? getWeatherIcon((weather as WeatherData).icon || "") : CloudSun;

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
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/25">
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
            <Badge variant={(autopilotConfig as { weatherAlertsEnabled?: boolean })?.weatherAlertsEnabled ? "default" : "secondary"}>
              {(autopilotConfig as { weatherAlertsEnabled?: boolean })?.weatherAlertsEnabled ? "Active" : "Disabled"}
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
              <Card key={alert.id} className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-amber-800 dark:text-amber-300">
                          {alert.title}
                        </span>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-400">{alert.message}</p>
                      {alert.guestsNotified > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
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
                {weather && (weather as WeatherData).updatedAt
                  ? `Updated ${formatDistanceToNow(new Date((weather as WeatherData).updatedAt as string), { addSuffix: true })}`
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
                    <div className="h-20 w-20 rounded-2xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                      <WeatherIcon className="h-10 w-10 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-foreground">
                        {Math.round((weather as WeatherData).temp || (weather as WeatherData).temperature || 0)}°F
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {(weather as WeatherData).description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 md:ml-auto">
                    <div className="text-center">
                      <Thermometer className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-medium">{Math.round((weather as WeatherData).feelsLike)}°F</p>
                      <p className="text-xs text-muted-foreground">Feels Like</p>
                    </div>
                    <div className="text-center">
                      <Droplets className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-medium">{(weather as WeatherData).humidity}%</p>
                      <p className="text-xs text-muted-foreground">Humidity</p>
                    </div>
                    <div className="text-center">
                      <Wind className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-medium">{Math.round((weather as WeatherData).windSpeed)} mph</p>
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
                  {forecast.slice(0, 5).map((day: Record<string, unknown>, i: number) => {
                    const DayIcon = getWeatherIcon((day.icon as string | undefined) || "");
                    const high = (day.high as number | undefined) || (day.tempHigh as number | undefined) || 0;
                    const low = (day.low as number | undefined) || (day.tempLow as number | undefined) || 0;
                    return (
                      <div key={i} className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {i === 0 ? "Today" : format(new Date(day.date as string), "EEE")}
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
              ) : (alerts as WeatherAlert[]).length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No weather alerts yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(alerts as WeatherAlert[]).slice(0, 10).map((alert) => (
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
                          {alert.createdAt && formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
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
