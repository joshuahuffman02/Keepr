"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Mail,
  Clock,
  CheckCircle2,
  FileText,
  HelpCircle,
  ExternalLink,
  LifeBuoy,
} from "lucide-react";

type TicketCategory = "issue" | "question" | "feature" | "other";

const CATEGORY_MAP: Record<string, TicketCategory> = {
  general: "question",
  billing: "issue",
  technical: "issue",
  feature: "feature",
  account: "issue",
  other: "other",
};

export default function ContactSupportPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    category: "general",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        title: formState.subject.trim() || "Support request",
        notes: formState.message.trim(),
        category: CATEGORY_MAP[formState.category] ?? "question",
        area: "support",
        submitter: {
          name: formState.name.trim(),
          email: formState.email.trim(),
        },
        extra: {
          topic: formState.category,
          source: "help-contact",
        },
      };

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = await response.json();
      setTicketId(data?.id ?? null);
      setSubmitted(true);
    } catch (error) {
      setErrorMessage("We could not send your message. Please try again or email support@keeprstay.com.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Breadcrumbs
            items={[
              { label: "Help", href: "/dashboard/help" },
              { label: "Contact Support" },
            ]}
          />

          <Card className="p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-status-success/15 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-status-success" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Message Sent
            </h1>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              We received your support request and will respond within 24 hours.
              Check your email for a confirmation with your ticket number.
            </p>
            {ticketId && (
              <p className="text-sm text-slate-500 mb-6">
                Ticket ID: {ticketId}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setTicketId(null);
                  setErrorMessage(null);
                  setFormState({
                    name: "",
                    email: "",
                    subject: "",
                    category: "general",
                    message: "",
                  });
                }}
              >
                Send Another Message
              </Button>
              <Link href="/dashboard/help">
                <Button>Back to Help Center</Button>
              </Link>
            </div>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Help", href: "/dashboard/help" },
            { label: "Contact Support" },
          ]}
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">
                Contact Support
              </h1>
              <p className="text-slate-600 mb-6">
                Have a question or need help? Fill out the form below and our
                team will get back to you.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Your Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={formState.name}
                      onChange={(e) =>
                        setFormState({ ...formState, name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={formState.email}
                      onChange={(e) =>
                        setFormState({ ...formState, email: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    value={formState.category}
                    onChange={(e) =>
                      setFormState({ ...formState, category: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="general">General Question</option>
                    <option value="billing">Billing & Payments</option>
                    <option value="technical">Technical Issue</option>
                    <option value="feature">Feature Request</option>
                    <option value="account">Account & Access</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    required
                    value={formState.subject}
                    onChange={(e) =>
                      setFormState({ ...formState, subject: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Brief description of your question"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={formState.message}
                    onChange={(e) =>
                      setFormState({ ...formState, message: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    placeholder="Please describe your question or issue in detail..."
                  />
                </div>

                {errorMessage && (
                  <div className="rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-sm text-status-error-text">
                    {errorMessage}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </Card>
          </div>

          {/* Contact Options Sidebar */}
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                Support expectations
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Standard support</span>
                  <span className="font-medium text-slate-900">
                    Within 1 business day
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Urgent issues</span>
                  <span className="font-medium text-slate-900">
                    Mark subject as urgent
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-900 mb-4">
                Other Ways to Reach Us
              </h2>
              <div className="space-y-4">
                <a
                  href="mailto:support@keeprstay.com"
                  className="flex items-center gap-3 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Email</div>
                    <div className="text-xs">support@keeprstay.com</div>
                  </div>
                </a>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <LifeBuoy className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">In-app chat</div>
                    <div className="text-xs">Open the help widget in the bottom right.</div>
                  </div>
                </div>
                <Link
                  href="/dashboard/help"
                  className="flex items-center gap-3 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Help Center</div>
                    <div className="text-xs">Browse guides and FAQs</div>
                  </div>
                </Link>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-900 mb-4">
                Before You Contact Us
              </h2>
              <div className="space-y-3">
                <Link
                  href="/dashboard/help/faq"
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                  Check our FAQ
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Link>
                <Link
                  href="/dashboard/help/tutorials"
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Browse Tutorials
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Link>
                <Link
                  href="/dashboard/help"
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Help Center
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
