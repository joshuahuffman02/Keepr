"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, LifeBuoy, Clock, Send } from "lucide-react";

type TicketCategory = "issue" | "question" | "feature" | "other";

const topicOptions: { value: string; label: string; category: TicketCategory }[] = [
    { value: "booking", label: "Booking question", category: "question" },
    { value: "account", label: "Account support", category: "issue" },
    { value: "host", label: "Campground owner inquiry", category: "question" },
    { value: "partnership", label: "Partnership opportunity", category: "other" },
    { value: "feedback", label: "Product feedback", category: "feature" },
    { value: "other", label: "Other", category: "other" },
];

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [ticketId, setTicketId] = useState<string | null>(null);

    const selectedTopic = useMemo(
        () => topicOptions.find((option) => option.value === formData.subject),
        [formData.subject]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMessage(null);

        try {
            const payload = {
                title: selectedTopic?.label ?? "General inquiry",
                notes: formData.message.trim(),
                category: selectedTopic?.category ?? "question",
                area: "public-contact",
                submitter: {
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                },
                extra: {
                    topic: formData.subject,
                    source: "contact-page",
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
            setErrorMessage("We could not send your message. Please try again or email hello@keeprstay.com.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 py-16">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                        Contact Us
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Have a question or need assistance? We&apos;d love to hear from you.
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <Mail className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">General inquiries</h3>
                                    <a href="mailto:hello@keeprstay.com" className="text-emerald-600 hover:underline">
                                        hello@keeprstay.com
                                    </a>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500">
                                Partnerships, press, and general questions.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                                    <LifeBuoy className="w-6 h-6 text-slate-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Product support</h3>
                                    <a href="mailto:support@keeprstay.com" className="text-emerald-600 hover:underline">
                                        support@keeprstay.com
                                    </a>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500">
                                For campground operators needing help in the app.
                            </p>
                        </div>

                        <div className="bg-slate-100 rounded-xl p-6 border border-slate-200">
                            <div className="flex items-center gap-3 mb-3">
                                <Clock className="w-5 h-5 text-slate-600" />
                                <h3 className="font-semibold text-slate-900">Response time</h3>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                                Typical response within one business day.
                            </p>
                            <Link href="/help" className="text-sm font-semibold text-emerald-600 hover:underline">
                                Visit the help center
                            </Link>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                            {submitted ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Send className="w-8 h-8 text-emerald-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Message Sent!</h2>
                                    <p className="text-slate-600 mb-2">
                                        Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                                    </p>
                                    {ticketId && (
                                        <p className="text-sm text-slate-500 mb-6">Ticket ID: {ticketId}</p>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSubmitted(false);
                                            setTicketId(null);
                                            setErrorMessage(null);
                                            setFormData({ name: "", email: "", subject: "", message: "" });
                                        }}
                                        className="text-emerald-600 font-semibold hover:underline"
                                    >
                                        Send another message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                                                Your Name
                                            </label>
                                            <input
                                                type="text"
                                                id="name"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                                placeholder="John Doe"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                                                Email Address
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
                                            Topic
                                        </label>
                                        <select
                                            id="subject"
                                            required
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                        >
                                            <option value="">Select a topic...</option>
                                            {topicOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
                                            Message
                                        </label>
                                        <textarea
                                            id="message"
                                            required
                                            rows={5}
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"
                                            placeholder="Tell us how we can help..."
                                        />
                                    </div>

                                    {errorMessage && (
                                        <div className="rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-sm text-status-error-text">
                                            {errorMessage}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="w-full py-4 bg-action-primary text-action-primary-foreground font-semibold rounded-lg hover:bg-action-primary-hover transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                        disabled={submitting}
                                    >
                                        {submitting ? "Sending..." : "Send Message"}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
