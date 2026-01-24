"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

export function DemoCTA() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    campgroundName: "",
    sites: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiUrl}/public/demo-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit demo request");
      }

      setSubmitted(true);

      // Reset form after 5 seconds
      setTimeout(() => {
        setSubmitted(false);
        setFormData({
          name: "",
          email: "",
          phone: "",
          campgroundName: "",
          sites: "",
          message: "",
        });
      }, 5000);
    } catch (err) {
      setError(
        "Something went wrong. Please try again or email us directly at sales@keeprstay.com",
      );
      console.error("Demo request error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <section className="py-20 bg-gradient-to-br from-keepr-evergreen to-keepr-evergreen-dark relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <div className="text-white">
            <p className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
              Get Started
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Ready to modernize your campground?
            </h2>
            <p className="text-lg text-white/80 mb-8">
              See how Keepr can streamline your operations with AI-powered tools, guest loyalty
              programs, and integrated staff scheduling.
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              {[
                "30-day money-back guarantee",
                "Early access pricing locked forever",
                "DIY setup guides included",
                "Optional setup assistance available",
                "Data import services available",
              ].map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-keepr-clay flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-white/80">{benefit}</span>
                </div>
              ))}
            </div>

            {/* Trust Badge */}
            <div className="mt-8 pt-8 border-t border-keepr-clay/30">
              <p className="text-white/70 text-sm mb-2">Built by campground enthusiasts</p>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">
                  Limited early access spots available
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Demo Form */}
          <div className="bg-card rounded-2xl shadow-2xl p-8 lg:p-10">
            {submitted ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-keepr-evergreen/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-keepr-evergreen" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Request Received!</h3>
                <p className="text-muted-foreground mb-4">
                  We'll be in touch within 24 hours to schedule your personalized demo.
                </p>
                <div className="bg-keepr-evergreen/10 border border-keepr-evergreen/20 rounded-lg p-3 text-sm text-keepr-charcoal">
                  <strong>What happens next:</strong>
                  <br />
                  Your request has been sent to our sales team at{" "}
                  <strong>sales@keeprstay.com</strong>. You'll receive a confirmation email shortly,
                  followed by a call from our onboarding specialist.
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-foreground mb-2">Get a Free Demo</h3>
                <p className="text-muted-foreground mb-6">
                  See how Keepr Host can work for your campground.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-foreground mb-1"
                      >
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-keepr-clay focus:border-keepr-clay outline-none transition"
                        placeholder="John Smith"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-foreground mb-1"
                      >
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-keepr-clay focus:border-keepr-clay outline-none transition"
                        placeholder="hello@keeprstay.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-keepr-clay focus:border-keepr-clay outline-none transition"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="campgroundName"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Campground Name *
                    </label>
                    <input
                      type="text"
                      id="campgroundName"
                      name="campgroundName"
                      required
                      value={formData.campgroundName}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-keepr-clay focus:border-keepr-clay outline-none transition"
                      placeholder="Pine Valley Campground"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="sites"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Number of Sites *
                    </label>
                    <select
                      id="sites"
                      name="sites"
                      required
                      value={formData.sites}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-keepr-clay focus:border-keepr-clay outline-none transition"
                    >
                      <option value="">Select range</option>
                      <option value="1-25">1-25 sites</option>
                      <option value="26-50">26-50 sites</option>
                      <option value="51-100">51-100 sites</option>
                      <option value="101-200">101-200 sites</option>
                      <option value="201+">201+ sites</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Additional Information
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={3}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-keepr-clay focus:border-keepr-clay outline-none transition resize-none"
                      placeholder="Tell us about your needs..."
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-keepr-evergreen hover:bg-keepr-evergreen-light text-white py-6 text-lg group disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Request Demo
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By submitting this form, you agree to receive communications from Keepr Host.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
