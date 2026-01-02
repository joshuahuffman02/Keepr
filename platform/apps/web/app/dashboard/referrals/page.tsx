"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Gift,
  Users,
  DollarSign,
  Copy,
  Check,
  Share2,
  Mail,
  Twitter,
  Facebook,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  ExternalLink
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.campeveryday.com";

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  stats: {
    totalClicks: number;
    totalSignups: number;
    totalConversions: number;
    pendingCredits: number;
    earnedCredits: number;
  };
  referrals: Array<{
    id: string;
    referredEmail: string;
    status: "clicked" | "signed_up" | "converted";
    creditAmount: number;
    createdAt: string;
    convertedAt?: string;
  }>;
}

function generateReferralCode(): string {
  // Generate a friendly code like "CAMP-XXXX"
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CAMP-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function ReferralsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:organizationId") : null;
    if (stored) {
      setOrganizationId(stored);
    }
  }, []);

  // Fetch referral data
  const { data: referralData, isLoading, error } = useQuery<ReferralStats>({
    queryKey: ["referral-stats", organizationId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/organizations/${organizationId}/referrals`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` }
      });
      if (!res.ok) {
        // Return mock data if endpoint doesn't exist yet
        const code = generateReferralCode();
        return {
          referralCode: code,
          referralLink: `${APP_URL}/signup?ref=${code}`,
          stats: {
            totalClicks: 0,
            totalSignups: 0,
            totalConversions: 0,
            pendingCredits: 0,
            earnedCredits: 0
          },
          referrals: []
        };
      }
      return res.json();
    },
    enabled: !!organizationId
  });

  // Use stable fallback data if endpoint not ready
  const fallbackCode = "CAMP-" + (organizationId?.slice(0, 4).toUpperCase() || "XXXX");
  const displayData: ReferralStats = referralData || {
    referralCode: fallbackCode,
    referralLink: `${APP_URL}/signup?ref=${fallbackCode}`,
    stats: {
      totalClicks: 0,
      totalSignups: 0,
      totalConversions: 0,
      pendingCredits: 0,
      earnedCredits: 0
    },
    referrals: []
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(displayData.referralLink);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with fellow campground owners." });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
    }
  };

  const handleShare = (platform: "email" | "twitter" | "facebook") => {
    const message = encodeURIComponent(
      "I've been using Camp Everyday to manage my campground and it's been great! Sign up with my referral link and we both get a $50 credit:"
    );
    const link = encodeURIComponent(displayData.referralLink);

    const urls: Record<string, string> = {
      email: `mailto:?subject=${encodeURIComponent("Try Camp Everyday - Campground Management Software")}&body=${message}%0A%0A${link}`,
      twitter: `https://twitter.com/intent/tweet?text=${message}&url=${link}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${link}&quote=${message}`
    };

    window.open(urls[platform], platform === "email" ? "_self" : "_blank");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "converted":
        return "bg-status-success-bg text-status-success-text";
      case "signed_up":
        return "bg-status-info-bg text-status-info-text";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gift className="h-6 w-6 text-emerald-600" />
              Referral Program
            </h1>
            <p className="text-muted-foreground mt-1">
              Earn $50 in credits for each campground you refer that gets their first booking
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700">
            <Sparkles className="h-3 w-3" />
            ${displayData.stats.earnedCredits} Earned
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{displayData.stats.totalClicks}</div>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Link Clicks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{displayData.stats.totalSignups}</div>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Users className="h-3 w-3" />
                Sign Ups
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{displayData.stats.totalConversions}</div>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Check className="h-3 w-3" />
                Conversions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">${displayData.stats.pendingCredits}</div>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Share Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-emerald-600" />
              Your Referral Link
            </CardTitle>
            <CardDescription>
              Share this link with other campground owners. When they sign up and receive their first booking, you both get $50 in credits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Referral Link */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  readOnly
                  value={displayData.referralLink}
                  className="pr-24 font-mono text-sm bg-muted"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Badge variant="outline" className="text-xs">
                    {displayData.referralCode}
                  </Badge>
                </div>
              </div>
              <Button onClick={handleCopyLink} variant={copied ? "secondary" : "default"}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="ml-2">{copied ? "Copied!" : "Copy"}</span>
              </Button>
            </div>

            {/* Share Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => handleShare("email")} className="flex-1 md:flex-none">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" onClick={() => handleShare("twitter")} className="flex-1 md:flex-none">
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              <Button variant="outline" onClick={() => handleShare("facebook")} className="flex-1 md:flex-none">
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">1. Share Your Link</h3>
                <p className="text-sm text-muted-foreground">
                  Send your unique referral link to fellow campground owners
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">2. They Sign Up</h3>
                <p className="text-sm text-muted-foreground">
                  Your friend joins Camp Everyday and sets up their campground
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">3. You Both Earn</h3>
                <p className="text-sm text-muted-foreground">
                  When they get their first booking, you both receive $50 in credits
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Referral History
            </CardTitle>
            <CardDescription>
              Track your referrals and earned credits
            </CardDescription>
          </CardHeader>
          <CardContent>
            {displayData.referrals.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No referrals yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Share your link to start earning credits
                </p>
                <Button onClick={handleCopyLink} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Referral Link
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayData.referrals.map((referral) => (
                  <div key={referral.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {referral.referredEmail || "Anonymous"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(referral.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(referral.status)}>
                        {referral.status === "converted"
                          ? "Converted"
                          : referral.status === "signed_up"
                          ? "Signed Up"
                          : "Clicked"}
                      </Badge>
                      {referral.status === "converted" && (
                        <span className="font-semibold text-emerald-600">
                          +${referral.creditAmount}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terms Note */}
        <p className="text-center text-sm text-muted-foreground">
          Credits are applied to your account after your referral receives their first booking.
          Credits can be used toward monthly fees or booking fees.{" "}
          <a href="/help/referrals" className="text-emerald-600 hover:underline">
            View full terms
          </a>
        </p>
      </div>
    </DashboardShell>
  );
}
