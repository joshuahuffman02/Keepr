"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Crown,
  Rocket,
  Star,
  Check,
  ArrowRight,
  Shield,
  Clock,
  AlertCircle,
  Loader2
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

type EarlyAccessTier = "founders_circle" | "pioneer" | "trailblazer";

interface TierAvailability {
  tier: string;
  totalSpots: number;
  remainingSpots: number;
  isSoldOut: boolean;
  pricing: {
    bookingFeeCents: number;
    monthlyFeeCents: number;
    monthlyDurationMonths: number | null;
    postPromoMonthlyFeeCents: number;
  };
}

const tierConfig = {
  founders_circle: {
    name: "Founder's Circle",
    icon: Crown,
    color: "amber",
    highlight: "Best Deal",
    monthlyDisplay: "$0/mo",
    durationDisplay: "forever",
    benefits: [
      "$0/month forever (not a typo)",
      "Lifetime 'Founder' badge on your listing",
      "Direct line to founders (phone/text)",
      "Co-create features with us",
      "First access to every new feature"
    ]
  },
  pioneer: {
    name: "Pioneer",
    icon: Rocket,
    color: "emerald",
    highlight: "Most Popular",
    monthlyDisplay: "$0/mo",
    durationDisplay: "for 12 months",
    benefits: [
      "$0/month for first 12 months",
      "Then just $29/month",
      "Priority support forever",
      "Early access to new features",
      "Free data migration"
    ]
  },
  trailblazer: {
    name: "Trailblazer",
    icon: Star,
    color: "violet",
    highlight: "Great Value",
    monthlyDisplay: "$14.50/mo",
    durationDisplay: "for 6 months",
    benefits: [
      "50% off for first 6 months",
      "Then $29/month",
      "Early access to new features",
      "Priority email support",
      "Free data migration"
    ]
  }
};

const colorStyles = {
  amber: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    badge: "bg-amber-500 text-slate-900",
    icon: "text-amber-400",
    button: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400",
    ring: "ring-amber-500",
    text: "text-amber-400"
  },
  emerald: {
    border: "border-emerald-500",
    bg: "bg-emerald-500/10",
    badge: "bg-emerald-500 text-white",
    icon: "text-emerald-400",
    button: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
    ring: "ring-emerald-500",
    text: "text-emerald-400"
  },
  violet: {
    border: "border-violet-500",
    bg: "bg-violet-500/10",
    badge: "bg-violet-500 text-white",
    icon: "text-violet-400",
    button: "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400",
    ring: "ring-violet-500",
    text: "text-violet-400"
  }
};

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"tier" | "details">("tier");
  const [selectedTier, setSelectedTier] = useState<EarlyAccessTier | null>(null);
  const [availability, setAvailability] = useState<TierAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [campgroundName, setCampgroundName] = useState("");
  const [phone, setPhone] = useState("");

  // Fetch availability on mount
  useEffect(() => {
    async function fetchAvailability() {
      try {
        const res = await fetch(`${API_BASE}/early-access/availability`);
        if (res.ok) {
          const data = await res.json();
          setAvailability(data);
        }
      } catch (err) {
        console.error("Failed to fetch availability:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAvailability();
  }, []);

  const handleTierSelect = (tier: EarlyAccessTier) => {
    const tierData = availability.find((t) => t.tier === tier);
    if (tierData?.isSoldOut) return;
    setSelectedTier(tier);
    setStep("details");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;

    setError("");
    setSubmitting(true);

    try {
      // First, register the user
      const registerRes = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName
        })
      });

      if (!registerRes.ok) {
        const data = await registerRes.json();
        throw new Error(data.message || "Registration failed");
      }

      const registerData = await registerRes.json();

      // Create an organization/campground placeholder
      // This will be completed during onboarding
      const signupRes = await fetch(`${API_BASE}/early-access/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${registerData.token}`
        },
        body: JSON.stringify({
          tier: selectedTier,
          campgroundName,
          phone,
          userId: registerData.id
        })
      });

      if (!signupRes.ok) {
        const data = await signupRes.json();
        throw new Error(data.message || "Signup failed");
      }

      // Redirect to confirmation page
      router.push(`/signup/confirm?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-semibold mb-6">
            <Clock className="h-4 w-4" />
            Early Access Program - Limited Spots
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {step === "tier" ? (
              <>
                Choose Your{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Early Access Tier
                </span>
              </>
            ) : (
              <>
                Complete Your{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Registration
                </span>
              </>
            )}
          </h1>

          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            {step === "tier"
              ? "Lock in your rate forever. Once these spots are gone, they're gone."
              : "Just a few details to reserve your spot."}
          </p>
        </div>

        {step === "tier" ? (
          /* Tier Selection */
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {(["founders_circle", "pioneer", "trailblazer"] as EarlyAccessTier[]).map((tierKey) => {
              const config = tierConfig[tierKey];
              const tierData = availability.find((t) => t.tier === tierKey);
              const styles = colorStyles[config.color as keyof typeof colorStyles];
              const isSoldOut = tierData?.isSoldOut ?? false;
              const spotsRemaining = tierData?.remainingSpots ?? 0;
              const bookingFee = tierData?.pricing?.bookingFeeCents
                ? `$${(tierData.pricing.bookingFeeCents / 100).toFixed(2)}`
                : "N/A";

              return (
                <div
                  key={tierKey}
                  className={`relative rounded-2xl border-2 ${styles.border} ${styles.bg} p-8 transition-all duration-300 ${
                    isSoldOut ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] cursor-pointer"
                  }`}
                  onClick={() => !isSoldOut && handleTierSelect(tierKey)}
                >
                  {/* Badge */}
                  <div
                    className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 ${styles.badge} text-sm font-bold rounded-full`}
                  >
                    {isSoldOut ? "Sold Out" : config.highlight}
                  </div>

                  {/* Header */}
                  <div className="text-center mb-8 pt-4">
                    <config.icon className={`h-12 w-12 mx-auto mb-4 ${styles.icon}`} />
                    <h3 className="text-2xl font-bold text-white mb-2">{config.name}</h3>

                    {/* Spots Counter */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className={`text-sm font-semibold ${styles.text}`}>
                        {isSoldOut ? "No spots remaining" : `${spotsRemaining} spots left`}
                      </span>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-white">{config.monthlyDisplay}</div>
                      <p className="text-slate-400">{config.durationDisplay}</p>
                      <div className="pt-2 border-t border-slate-700/50">
                        <span className="text-emerald-400 font-semibold">{bookingFee} per booking</span>
                        <span className="text-slate-500 text-sm block">(locked forever)</span>
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <ul className="space-y-3 mb-8">
                    {config.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-300 text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className={`w-full py-6 text-lg font-semibold ${styles.button} text-white shadow-lg`}
                    disabled={isSoldOut}
                  >
                    {isSoldOut ? "Sold Out" : "Select This Tier"}
                    {!isSoldOut && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Registration Form */
          <div className="max-w-lg mx-auto">
            {/* Selected tier indicator */}
            {selectedTier && (
              <div className="mb-8 p-4 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = tierConfig[selectedTier];
                    const Icon = config.icon;
                    const styles = colorStyles[config.color as keyof typeof colorStyles];
                    return (
                      <>
                        <Icon className={`h-6 w-6 ${styles.icon}`} />
                        <div>
                          <p className="text-white font-semibold">{config.name}</p>
                          <p className="text-slate-400 text-sm">
                            {availability.find((t) => t.tier === selectedTier)?.remainingSpots} spots remaining
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setStep("tier")}
                  className="text-slate-400 hover:text-white text-sm underline"
                >
                  Change
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
                  <Input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
                  <Input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="Smith"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  placeholder="john@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  placeholder="At least 8 characters"
                />
              </div>

              {/* Campground Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Campground Name</label>
                <Input
                  type="text"
                  required
                  value={campgroundName}
                  onChange={(e) => setCampgroundName(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  placeholder="Sunny Acres RV Park"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                <Input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Reserving Your Spot...
                  </>
                ) : (
                  <>
                    Reserve My Spot
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-6 pt-4 text-slate-500 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>30-day money back</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </form>

            {/* Sign in link */}
            <p className="mt-8 text-center text-slate-400">
              Already have an account?{" "}
              <Link href="/auth/signin" className="text-emerald-400 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
