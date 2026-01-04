"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Phone,
  Mail,
  FileText,
  Globe,
  CheckCircle2,
  ArrowRight,
  Loader2,
  MapPin,
  Building2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { use } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

type VerificationMethod = "phone" | "email" | "document" | "domain";

interface ClaimFormData {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  role: string;
  verificationMethod: VerificationMethod;
}

export default function ClaimCampgroundPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify" | "success">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");

  const [formData, setFormData] = useState<ClaimFormData>({
    businessName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    role: "",
    verificationMethod: "email",
  });

  const verificationMethods = [
    {
      id: "email" as const,
      name: "Email Verification",
      description: "We'll send a verification code to your business email",
      icon: <Mail className="h-5 w-5" />,
    },
    {
      id: "phone" as const,
      name: "Phone Verification",
      description: "We'll call or text your business phone number",
      icon: <Phone className="h-5 w-5" />,
    },
    {
      id: "document" as const,
      name: "Document Upload",
      description: "Upload business license or ownership documents",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      id: "domain" as const,
      name: "Domain Verification",
      description: "Verify ownership via your campground's website",
      icon: <Globe className="h-5 w-5" />,
    },
  ];

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundSlug: slug,
          ...formData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to submit claim");
      }

      const data = await res.json();
      setClaimId(data.id);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/claims/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          verificationCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Invalid verification code");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="text-xl font-bold text-emerald-600">
            Keepr
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {["Claim Details", "Verification", "Complete"].map((label, index) => {
            const stepNum = index + 1;
            const isActive =
              (step === "form" && stepNum === 1) ||
              (step === "verify" && stepNum === 2) ||
              (step === "success" && stepNum === 3);
            const isComplete =
              (step === "verify" && stepNum === 1) ||
              (step === "success" && stepNum <= 2);

            return (
              <div key={label} className="flex items-center gap-4">
                <div
                  className={`flex items-center gap-2 ${
                    isComplete
                      ? "text-emerald-600"
                      : isActive
                        ? "text-slate-900"
                        : "text-slate-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isComplete
                        ? "bg-emerald-600 text-white"
                        : isActive
                          ? "bg-slate-900 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isComplete ? <CheckCircle2 className="h-5 w-5" /> : stepNum}
                  </div>
                  <span className="hidden sm:inline font-medium">{label}</span>
                </div>
                {index < 2 && (
                  <div
                    className={`w-12 h-0.5 ${isComplete ? "bg-emerald-600" : "bg-slate-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Step */}
        {step === "form" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                <Shield className="h-8 w-8 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Claim Your Campground
              </h1>
              <p className="text-slate-600">
                Verify your ownership to manage your listing on Keepr
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitClaim} className="space-y-6">
              {/* Business Info */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-400" />
                  Business Information
                </h2>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Your Campground LLC"
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <User className="h-5 w-5 text-slate-400" />
                  Contact Information
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contactName}
                      onChange={(e) =>
                        setFormData({ ...formData, contactName: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Your Role
                    </label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({ ...formData, role: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select role...</option>
                      <option value="owner">Owner</option>
                      <option value="manager">Manager</option>
                      <option value="employee">Employee</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, contactEmail: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="john@campground.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, contactPhone: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Verification Method */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Verification Method
                </h2>
                <p className="text-sm text-slate-600">
                  Choose how you'd like to verify your ownership
                </p>

                <div className="grid sm:grid-cols-2 gap-3">
                  {verificationMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        formData.verificationMethod === method.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="verificationMethod"
                        value={method.id}
                        checked={formData.verificationMethod === method.id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            verificationMethod: e.target.value as VerificationMethod,
                          })
                        }
                        className="sr-only"
                      />
                      <span
                        className={`mt-0.5 ${
                          formData.verificationMethod === method.id
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }`}
                      >
                        {method.icon}
                      </span>
                      <div>
                        <div className="font-medium text-slate-900">{method.name}</div>
                        <div className="text-sm text-slate-500">{method.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Continue to Verification
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Verification Step */}
        {step === "verify" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Enter Verification Code
              </h1>
              <p className="text-slate-600">
                We've sent a 6-digit code to{" "}
                <span className="font-medium">{formData.contactEmail}</span>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="000000"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || verificationCode.length !== 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Code
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-slate-500">
                Didn't receive the code?{" "}
                <button type="button" className="text-emerald-600 hover:underline">
                  Resend code
                </button>
              </p>
            </form>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Claim Submitted Successfully!
            </h1>
            <p className="text-slate-600 mb-8">
              Your claim is being reviewed by our team. We'll notify you via email
              within 24-48 hours once your ownership is verified.
            </p>

            <div className="bg-slate-50 rounded-xl p-6 mb-8">
              <h2 className="font-semibold text-slate-900 mb-4">What happens next?</h2>
              <div className="space-y-3 text-left">
                {[
                  "Our team reviews your submitted information",
                  "We may contact you for additional verification",
                  "Once approved, you'll receive access to your dashboard",
                  "Start managing reservations and updating your listing",
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-sm flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/campground/${slug}`}>View Your Listing</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Benefits */}
        {step === "form" && (
          <div className="mt-12 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6">
              Benefits of Claiming Your Listing
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Accept online reservations 24/7",
                "Update photos and descriptions",
                "Respond to guest reviews",
                "Access analytics and insights",
                "No marketplace commission",
                "Direct payment to your account",
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <span className="text-slate-600">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
