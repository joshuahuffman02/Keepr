"use client";

import { useState, useEffect } from "react";
import { Heart, Check, DollarSign } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface CharityConfig {
  id: string;
  campgroundId: string;
  charityId: string;
  isEnabled: boolean;
  customMessage: string | null;
  roundUpType: string;
  roundUpOptions: Record<string, unknown> | null;
  defaultOptIn: boolean;
  charity: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    category: string | null;
    isVerified: boolean;
  };
}

interface RoundUpCalculation {
  originalAmountCents: number;
  roundedAmountCents: number;
  donationAmountCents: number;
  charityName: string;
  charityId: string;
}

interface RoundUpForCharityProps {
  campgroundId: string;
  totalCents: number;
  onChange: (donation: { optedIn: boolean; amountCents: number; charityId: string | null }) => void;
}

type DonationType = "none" | "roundup" | "custom";

const PRESET_AMOUNTS = [100, 500, 1000, 2500]; // $1, $5, $10, $25

export function RoundUpForCharity({ campgroundId, totalCents, onChange }: RoundUpForCharityProps) {
  const [charityConfig, setCharityConfig] = useState<CharityConfig | null>(null);
  const [roundUp, setRoundUp] = useState<RoundUpCalculation | null>(null);
  const [donationType, setDonationType] = useState<DonationType>("none");
  const [customAmountCents, setCustomAmountCents] = useState<number>(500); // Default $5
  const [customInput, setCustomInput] = useState<string>("5.00");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCharityConfig = async () => {
      try {
        setLoading(true);
        const config = await apiClient.getCampgroundCharity(campgroundId);
        setCharityConfig(config);

        if (config?.isEnabled) {
          const calculation = await apiClient.calculateRoundUp(campgroundId, totalCents);
          setRoundUp(calculation);

          // Set default opt-in based on campground settings
          if (config.defaultOptIn && calculation.donationAmountCents > 0) {
            setDonationType("roundup");
            onChange({
              optedIn: true,
              amountCents: calculation.donationAmountCents,
              charityId: calculation.charityId,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load charity config:", err);
        setError("Unable to load charity options");
      } finally {
        setLoading(false);
      }
    };

    if (campgroundId && totalCents > 0) {
      fetchCharityConfig();
    }
  }, [campgroundId, totalCents]);

  const handleDonationTypeChange = (type: DonationType) => {
    setDonationType(type);

    if (type === "none") {
      onChange({ optedIn: false, amountCents: 0, charityId: null });
    } else if (type === "roundup" && roundUp) {
      onChange({
        optedIn: true,
        amountCents: roundUp.donationAmountCents,
        charityId: roundUp.charityId,
      });
    } else if (type === "custom" && charityConfig) {
      onChange({
        optedIn: true,
        amountCents: customAmountCents,
        charityId: charityConfig.charity.id,
      });
    }
  };

  const handleCustomAmountChange = (cents: number) => {
    setCustomAmountCents(cents);
    setCustomInput((cents / 100).toFixed(2));
    if (donationType === "custom" && charityConfig) {
      onChange({
        optedIn: true,
        amountCents: cents,
        charityId: charityConfig.charity.id,
      });
    }
  };

  const handleCustomInputChange = (value: string) => {
    setCustomInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      const cents = Math.round(parsed * 100);
      setCustomAmountCents(cents);
      if (donationType === "custom" && charityConfig) {
        onChange({
          optedIn: true,
          amountCents: cents,
          charityId: charityConfig.charity.id,
        });
      }
    }
  };

  // Don't render if charity is not enabled
  if (loading) {
    return (
      <div className="rounded-lg border border-border p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4"></div>
      </div>
    );
  }

  if (error || !charityConfig?.isEnabled) {
    return null;
  }

  const currentDonationCents = donationType === "roundup"
    ? (roundUp?.donationAmountCents || 0)
    : donationType === "custom"
      ? customAmountCents
      : 0;
  const newTotal = ((totalCents + currentDonationCents) / 100).toFixed(2);

  return (
    <div className="rounded-xl border-2 border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-pink-500 text-white">
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              Support {charityConfig.charity.name}
              {charityConfig.charity.isVerified && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-status-success-bg text-status-success-text">
                  <Check className="h-3 w-3 mr-0.5" />
                  Verified
                </span>
              )}
            </h4>
            {charityConfig.charity.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {charityConfig.charity.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Donation Options */}
      <div className="p-4 space-y-3">
        {charityConfig.customMessage && (
          <p className="text-sm text-muted-foreground mb-3">{charityConfig.customMessage}</p>
        )}

        {/* No Donation Option */}
        <label
          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
            donationType === "none"
              ? "border-border bg-muted"
              : "border-border hover:border-border"
          }`}
        >
          <input
            type="radio"
            name="donationType"
            checked={donationType === "none"}
            onChange={() => handleDonationTypeChange("none")}
            className="w-4 h-4 text-muted-foreground focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">No donation this time</span>
        </label>

        {/* Round Up Option */}
        {roundUp && roundUp.donationAmountCents > 0 && (
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              donationType === "roundup"
                ? "border-pink-500 bg-pink-50"
                : "border-border hover:border-pink-300"
            }`}
          >
            <input
              type="radio"
              name="donationType"
              checked={donationType === "roundup"}
              onChange={() => handleDonationTypeChange("roundup")}
              className="w-4 h-4 text-pink-600 focus:ring-pink-500"
            />
            <div className="flex-1">
              <span className="text-sm text-foreground">
                Round up to <span className="font-semibold">${(roundUp.roundedAmountCents / 100).toFixed(2)}</span>
              </span>
              <span className="ml-2 text-sm text-pink-600 font-medium">
                (+${(roundUp.donationAmountCents / 100).toFixed(2)} donation)
              </span>
            </div>
          </label>
        )}

        {/* Custom Amount Option */}
        <div
          className={`rounded-lg border-2 transition-all ${
            donationType === "custom"
              ? "border-pink-500 bg-pink-50"
              : "border-border"
          }`}
        >
          <label
            className="flex items-center gap-3 p-3 cursor-pointer"
            onClick={() => handleDonationTypeChange("custom")}
          >
            <input
              type="radio"
              name="donationType"
              checked={donationType === "custom"}
              onChange={() => handleDonationTypeChange("custom")}
              className="w-4 h-4 text-pink-600 focus:ring-pink-500"
            />
            <span className="text-sm text-foreground">Custom donation amount</span>
          </label>

          {donationType === "custom" && (
            <div className="px-3 pb-3 pt-1 space-y-3">
              {/* Preset Amounts */}
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => handleCustomAmountChange(cents)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      customAmountCents === cents
                        ? "bg-pink-500 text-white"
                        : "bg-card border border-border text-foreground hover:border-pink-400"
                    }`}
                  >
                    ${(cents / 100).toFixed(0)}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customInput}
                    onChange={(e) => handleCustomInputChange(e.target.value)}
                    onFocus={() => handleDonationTypeChange("custom")}
                    className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="Enter amount"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {donationType !== "none" && currentDonationCents > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Donation: <span className="font-semibold text-pink-600">${(currentDonationCents / 100).toFixed(2)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              New total: <span className="font-medium text-foreground">${newTotal}</span>
            </span>
          </div>
        )}
      </div>

      {/* Footer with charity logo */}
      {charityConfig.charity.logoUrl && (
        <div className="px-4 py-3 bg-muted border-t border-border flex items-center gap-2">
          <img
            src={charityConfig.charity.logoUrl}
            alt={charityConfig.charity.name}
            className="h-5 w-auto object-contain"
          />
          <span className="text-xs text-muted-foreground">
            100% of your donation goes to {charityConfig.charity.name}
          </span>
        </div>
      )}
    </div>
  );
}

// Simplified inline version for tight spaces (like POS)
export function RoundUpInline({ campgroundId, totalCents, onChange }: RoundUpForCharityProps) {
  const [charityConfig, setCharityConfig] = useState<CharityConfig | null>(null);
  const [roundUp, setRoundUp] = useState<RoundUpCalculation | null>(null);
  const [donationType, setDonationType] = useState<DonationType>("none");
  const [customAmountCents, setCustomAmountCents] = useState<number>(100);
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharityConfig = async () => {
      try {
        setLoading(true);
        const config = await apiClient.getCampgroundCharity(campgroundId);
        setCharityConfig(config);

        if (config?.isEnabled) {
          const calculation = await apiClient.calculateRoundUp(campgroundId, totalCents);
          setRoundUp(calculation);

          if (config.defaultOptIn && calculation.donationAmountCents > 0) {
            setDonationType("roundup");
            onChange({
              optedIn: true,
              amountCents: calculation.donationAmountCents,
              charityId: calculation.charityId,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load charity config:", err);
      } finally {
        setLoading(false);
      }
    };

    if (campgroundId && totalCents > 0) {
      fetchCharityConfig();
    }
  }, [campgroundId, totalCents]);

  const handleRoundUpToggle = () => {
    if (donationType === "roundup") {
      setDonationType("none");
      onChange({ optedIn: false, amountCents: 0, charityId: null });
    } else {
      setDonationType("roundup");
      setShowCustom(false);
      if (roundUp) {
        onChange({
          optedIn: true,
          amountCents: roundUp.donationAmountCents,
          charityId: roundUp.charityId,
        });
      }
    }
  };

  const handleCustomAmount = (cents: number) => {
    setCustomAmountCents(cents);
    setDonationType("custom");
    if (charityConfig) {
      onChange({
        optedIn: true,
        amountCents: cents,
        charityId: charityConfig.charity.id,
      });
    }
  };

  if (loading || !charityConfig?.isEnabled) {
    return null;
  }

  const currentAmount = donationType === "roundup"
    ? (roundUp?.donationAmountCents || 0)
    : donationType === "custom"
      ? customAmountCents
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={donationType !== "none"}
            onChange={handleRoundUpToggle}
            className="w-4 h-4 rounded border-border text-pink-600 focus:ring-pink-500"
          />
          <div className="flex items-center gap-2 text-sm">
            <Heart className={`h-4 w-4 ${donationType !== "none" ? "text-pink-500 fill-current" : "text-muted-foreground"}`} />
            <span className="text-foreground">
              {roundUp && roundUp.donationAmountCents > 0 ? (
                <>
                  Round up <span className="font-medium text-pink-600">${(roundUp.donationAmountCents / 100).toFixed(2)}</span> for{" "}
                </>
              ) : (
                <>Donate to </>
              )}
              <span className="font-medium">{charityConfig.charity.name}</span>
            </span>
          </div>
        </label>

        {donationType !== "none" && (
          <button
            type="button"
            onClick={() => setShowCustom(!showCustom)}
            className="text-xs text-pink-600 hover:text-pink-700 font-medium"
          >
            {showCustom ? "Hide" : "Custom amount"}
          </button>
        )}
      </div>

      {showCustom && donationType !== "none" && (
        <div className="flex items-center gap-2 pl-7">
          {[100, 200, 500, 1000].map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => handleCustomAmount(cents)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                donationType === "custom" && customAmountCents === cents
                  ? "bg-pink-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-pink-100"
              }`}
            >
              ${(cents / 100).toFixed(0)}
            </button>
          ))}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={(customAmountCents / 100).toFixed(0)}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                handleCustomAmount(val * 100);
              }}
              className="w-16 pl-5 pr-2 py-1 text-xs border border-border rounded focus:ring-1 focus:ring-pink-500"
              placeholder="Other"
            />
          </div>
        </div>
      )}

      {donationType !== "none" && currentAmount > 0 && (
        <p className="text-xs text-muted-foreground pl-7">
          Adding <span className="font-medium text-pink-600">${(currentAmount / 100).toFixed(2)}</span> donation
        </p>
      )}
    </div>
  );
}
