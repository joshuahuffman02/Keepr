"use client";

import { useMemo } from "react";
import { Check, RefreshCw, ExternalLink, Lightbulb, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StripeCapabilities {
  us_bank_account_ach_payments?: string;
  card_payments?: string;
  transfers?: string;
  apple_pay?: string;
  google_pay?: string;
  link_payments?: string;
}

interface StripeConnectCardProps {
  stripeAccountId: string | null;
  capabilities: StripeCapabilities;
  capabilitiesFetchedAt: string | null;
  onConnect: () => void;
  onRefreshCapabilities: () => void;
  isConnecting: boolean;
  isRefreshing: boolean;
  campgroundId: string;
}

export function StripeConnectCard({
  stripeAccountId,
  capabilities,
  capabilitiesFetchedAt,
  onConnect,
  onRefreshCapabilities,
  isConnecting,
  isRefreshing,
  campgroundId,
}: StripeConnectCardProps) {
  const CAPABILITIES_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

  const isConnected = !!stripeAccountId;

  const capabilitiesStale = useMemo(() => {
    if (!capabilitiesFetchedAt) return true;
    const fetched = new Date(capabilitiesFetchedAt).getTime();
    return Date.now() - fetched > CAPABILITIES_MAX_AGE_MS;
  }, [capabilitiesFetchedAt]);

  const achActive = capabilities?.us_bank_account_ach_payments === "active";
  const walletsActive = capabilities?.card_payments === "active" && capabilities?.transfers === "active";
  const appleActive = capabilities?.apple_pay === "active";
  const googleActive = capabilities?.google_pay === "active" || capabilities?.link_payments === "active";

  const lastRefreshedLabel = useMemo(() => {
    if (!capabilitiesFetchedAt) return "Never";
    try {
      return new Date(capabilitiesFetchedAt).toLocaleString();
    } catch {
      return String(capabilitiesFetchedAt);
    }
  }, [capabilitiesFetchedAt]);

  return (
    <Card className={cn(
      "transition-all duration-300",
      isConnected && "border-emerald-200 bg-emerald-50/30"
    )}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Stripe Connect
              {isConnected && (
                <Badge className="bg-status-success-bg text-status-success-text border border-status-success-border motion-safe:animate-in motion-safe:fade-in">
                  <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                  <span className="sr-only">Status: </span>
                  Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {isConnected
                ? "Your Stripe account is connected and ready to accept payments."
                : "Connect your Stripe account to accept payments from guests."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Success state with celebration */}
        {isConnected && (
          <div
            className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
            role="status"
            aria-live="polite"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 motion-safe:animate-in motion-safe:zoom-in">
              <Check className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-emerald-900">Ready to accept payments</p>
              <p className="text-sm text-emerald-700 truncate">
                Account: <code className="bg-emerald-100 px-1.5 py-0.5 rounded text-xs">{stripeAccountId}</code>
              </p>
            </div>
          </div>
        )}

        {/* Payment capabilities */}
        {isConnected && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Payment methods</h4>
            <div className="grid grid-cols-2 gap-2">
              <CapabilityBadge
                label="Cards"
                active={walletsActive}
                description="Credit & debit"
              />
              <CapabilityBadge
                label="ACH"
                active={achActive}
                description="Bank transfers"
              />
              <CapabilityBadge
                label="Apple Pay"
                active={appleActive}
                description="Digital wallet"
              />
              <CapabilityBadge
                label="Google Pay"
                active={googleActive}
                description="Digital wallet"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Last checked: {lastRefreshedLabel}</span>
              {capabilitiesStale && (
                <span className="text-amber-600">(may be outdated)</span>
              )}
            </div>
          </div>
        )}

        {/* Stale capabilities warning */}
        {isConnected && capabilitiesStale && (
          <div
            className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 flex items-start gap-3"
            role="status"
            aria-live="polite"
          >
            <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-blue-900">Refresh recommended</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Check for any changes to your payment capabilities from Stripe.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onConnect}
            disabled={!campgroundId || isConnecting}
            variant={isConnected ? "outline" : "default"}
            className={cn(
              "transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none",
              !isConnected && "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                Manage in Stripe
              </>
            ) : (
              "Connect Stripe"
            )}
          </Button>

          {isConnected && (
            <Button
              variant="outline"
              size="default"
              onClick={onRefreshCapabilities}
              disabled={!campgroundId || isRefreshing}
              className="transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Refresh capabilities
                </>
              )}
            </Button>
          )}
        </div>

        {/* Not connected helper */}
        {!isConnected && (
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
            You'll be redirected to Stripe to complete setup. This usually takes 5-10 minutes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface CapabilityBadgeProps {
  label: string;
  active: boolean;
  description: string;
}

function CapabilityBadge({ label, active, description }: CapabilityBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg border transition-colors",
        active
          ? "bg-emerald-50 border-emerald-200"
          : "bg-muted border-border"
      )}
    >
      <div
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          active ? "bg-emerald-500" : "bg-muted"
        )}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className={cn(
          "text-sm font-medium",
          active ? "text-emerald-900" : "text-muted-foreground"
        )}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span className="sr-only">
        {label}: {active ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}
