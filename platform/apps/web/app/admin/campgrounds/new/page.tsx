"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Save, ArrowLeft, User, Copy, Check, X } from "lucide-react";

function getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("campreserv:authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
];

const states = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

function generateTempPassword(): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

type CreatedData = {
    campgroundName: string;
    campgroundSlug: string;
    adminEmail: string;
    adminPassword: string;
};

export default function CreateCampgroundPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdData, setCreatedData] = useState<CreatedData | null>(null);
    const [copied, setCopied] = useState(false);

    const [form, setForm] = useState({
        // Campground info
        name: "",
        slug: "",
        city: "",
        state: "",
        country: "USA",
        timezone: "America/Chicago",
        phone: "",
        email: "",
        website: "",
        // Admin user info
        adminFirstName: "",
        adminLastName: "",
        adminEmail: "",
    });

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
    };

    const handleNameChange = (name: string) => {
        setForm((prev) => ({
            ...prev,
            name,
            slug: generateSlug(name),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const tempPassword = generateTempPassword();

        try {
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/admin/campgrounds`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                credentials: "include",
                body: JSON.stringify({
                    campground: {
                        name: form.name,
                        slug: form.slug,
                        city: form.city,
                        state: form.state,
                        country: form.country,
                        timezone: form.timezone,
                        phone: form.phone || undefined,
                        email: form.email || undefined,
                        website: form.website || undefined,
                    },
                    admin: {
                        firstName: form.adminFirstName,
                        lastName: form.adminLastName,
                        email: form.adminEmail,
                        password: tempPassword,
                    },
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || `Failed to create campground (${res.status})`);
            }

            // Show success modal with credentials
            setCreatedData({
                campgroundName: form.name,
                campgroundSlug: form.slug,
                adminEmail: form.adminEmail,
                adminPassword: tempPassword,
            });
        } catch (err: any) {
            setError(err.message || "Failed to create campground");
        } finally {
            setLoading(false);
        }
    };

    const copyCredentials = () => {
        if (!createdData) return;
        const text = `Campground: ${createdData.campgroundName}
URL: ${window.location.origin}/park/${createdData.campgroundSlug}
Admin Email: ${createdData.adminEmail}
Temporary Password: ${createdData.adminPassword}

Note: The admin will be required to change their password on first login.`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const resetForm = () => {
        setCreatedData(null);
        setForm({
            name: "",
            slug: "",
            city: "",
            state: "",
            country: "USA",
            timezone: "America/Chicago",
            phone: "",
            email: "",
            website: "",
            adminFirstName: "",
            adminLastName: "",
            adminEmail: "",
        });
    };

    // Success Modal
    if (createdData) {
        return (
            <div className="max-w-2xl space-y-6">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-500/20 rounded-full">
                            <Check className="h-6 w-6 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Campground Created!</h2>
                    </div>

                    <div className="bg-slate-900 rounded-lg p-4 space-y-3 mb-4">
                        <div>
                            <div className="text-xs text-slate-500 uppercase">Campground</div>
                            <div className="text-white font-medium">{createdData.campgroundName}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase">Public URL</div>
                            <div className="text-blue-400 font-mono text-sm">/park/{createdData.campgroundSlug}</div>
                        </div>
                        <hr className="border-slate-700" />
                        <div>
                            <div className="text-xs text-slate-500 uppercase">Admin Email</div>
                            <div className="text-white font-mono">{createdData.adminEmail}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase">Temporary Password</div>
                            <div className="text-amber-400 font-mono text-lg">{createdData.adminPassword}</div>
                        </div>
                    </div>

                    <p className="text-sm text-slate-400 mb-4">
                        <strong className="text-amber-400">Important:</strong> The admin will be required to
                        change their password on first login. Copy these credentials and send them to the
                        campground owner.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={copyCredentials}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? "Copied!" : "Copy Credentials"}
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            Create Another
                        </button>
                        <Link
                            href="/admin/campgrounds"
                            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            Back to List
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/campgrounds"
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Create Campground</h1>
                    <p className="text-slate-400 mt-1">Add a new campground with an admin user</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Campground Info */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <Building2 className="h-5 w-5 text-slate-400" />
                        <h2 className="text-lg font-semibold text-white">Campground Info</h2>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Campground Name *
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Pine Valley RV Resort"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            URL Slug *
                        </label>
                        <input
                            type="text"
                            value={form.slug}
                            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                            required
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="pine-valley-rv-resort"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Used in URLs: /park/{form.slug || "your-slug"}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                City *
                            </label>
                            <input
                                type="text"
                                value={form.city}
                                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                                required
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                State *
                            </label>
                            <select
                                value={form.state}
                                onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                                required
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select state</option>
                                {states.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Timezone *
                        </label>
                        <select
                            value={form.timezone}
                            onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                            required
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {timezones.map((tz) => (
                                <option key={tz} value={tz}>
                                    {tz}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="(555) 123-4567"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="info@campground.com"
                            />
                        </div>
                    </div>
                </div>

                {/* Admin User */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <User className="h-5 w-5 text-slate-400" />
                        <div>
                            <h2 className="text-lg font-semibold text-white">Admin User</h2>
                            <p className="text-sm text-slate-400">Create the campground administrator account</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                First Name *
                            </label>
                            <input
                                type="text"
                                value={form.adminFirstName}
                                onChange={(e) => setForm((prev) => ({ ...prev, adminFirstName: e.target.value }))}
                                required
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Last Name *
                            </label>
                            <input
                                type="text"
                                value={form.adminLastName}
                                onChange={(e) => setForm((prev) => ({ ...prev, adminLastName: e.target.value }))}
                                required
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Admin Email *
                        </label>
                        <input
                            type="email"
                            value={form.adminEmail}
                            onChange={(e) => setForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
                            required
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="owner@campground.com"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            A temporary password will be generated. The admin must change it on first login.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Link
                        href="/admin/campgrounds"
                        className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        <Save className="h-4 w-4" />
                        {loading ? "Creating..." : "Create Campground & Admin"}
                    </button>
                </div>
            </form>
        </div>
    );
}
