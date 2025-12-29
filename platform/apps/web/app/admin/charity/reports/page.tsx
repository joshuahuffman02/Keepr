"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  Users,
  Building2,
  FileText,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface DonationReport {
  donations: Array<{
    id: string;
    amountCents: number;
    status: string;
    createdAt: string;
    charity: { id: string; name: string };
    reservation: {
      id: string;
      arrivalDate: string;
      departureDate: string;
      guest: { firstName: string; lastName: string; email: string };
    };
  }>;
  total: number;
}

interface PayoutReport {
  payouts: Array<{
    id: string;
    amountCents: number;
    status: string;
    payoutDate: string | null;
    reference: string | null;
    createdAt: string;
    charity: { id: string; name: string };
    _count: { donations: number };
  }>;
  total: number;
}

interface PlatformStats {
  totalDonations: number;
  totalAmountCents: number;
  donorCount: number;
  optInRate: number;
  averageDonationCents: number;
  byStatus: Array<{ status: string; count: number; amountCents: number }>;
  byCharity: Array<{
    charity: { id: string; name: string; logoUrl: string | null } | null;
    count: number;
    amountCents: number;
  }>;
}

export default function CharityReportsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [donations, setDonations] = useState<DonationReport | null>(null);
  const [payouts, setPayouts] = useState<PayoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "donations" | "payouts">("overview");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      const [statsRes, donationsRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE}/api/charity/stats/platform?${params}`),
        fetch(`${API_BASE}/api/admin/charity/donations?${params}&limit=100`),
        fetch(`${API_BASE}/api/admin/charity/payouts?limit=50`),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (donationsRes.ok) {
        setDonations(await donationsRes.json());
      }
      if (payoutsRes.ok) {
        setPayouts(await payoutsRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch charity reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!donations?.donations) return;

    const headers = ["Date", "Charity", "Guest", "Email", "Amount", "Status", "Reservation ID"];
    const rows = donations.donations.map((d) => [
      new Date(d.createdAt).toLocaleDateString(),
      d.charity.name,
      `${d.reservation.guest.firstName} ${d.reservation.guest.lastName}`,
      d.reservation.guest.email,
      `$${(d.amountCents / 100).toFixed(2)}`,
      d.status,
      d.reservation.id.slice(-8).toUpperCase(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `charity-donations-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "collected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle className="h-3 w-3" /> Collected
          </span>
        );
      case "pending_payout":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Pending Payout
          </span>
        );
      case "paid_out":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <DollarSign className="h-3 w-3" /> Paid Out
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle className="h-3 w-3" /> Refunded
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle className="h-3 w-3" /> Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin/charity"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Charity Reports</h1>
              <p className="text-slate-600">Detailed donation analytics and payout tracking</p>
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            {([
              { id: "overview" as const, label: "Overview", icon: TrendingUp },
              { id: "donations" as const, label: "Donations", icon: Heart },
              { id: "payouts" as const, label: "Payouts", icon: DollarSign },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && stats && (
              <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-pink-100 text-pink-600">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-slate-600">Total Raised</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                      ${(stats.totalAmountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                        <Heart className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-slate-600">Total Donations</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                      {stats.totalDonations.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                        <Users className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-slate-600">Unique Donors</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                      {stats.donorCount.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-slate-600">Opt-in Rate</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                      {stats.optInRate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* By Charity */}
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="p-6 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-900">Donations by Charity</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {stats.byCharity.map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.charity?.logoUrl ? (
                            <img
                              src={item.charity.logoUrl}
                              alt={item.charity.name}
                              className="h-10 w-10 rounded-lg object-contain"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center">
                              <Heart className="h-5 w-5 text-pink-500" />
                            </div>
                          )}
                          <span className="font-medium text-slate-900">
                            {item.charity?.name || "Unknown Charity"}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            ${(item.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-slate-500">{item.count} donations</p>
                        </div>
                      </div>
                    ))}
                    {stats.byCharity.length === 0 && (
                      <div className="p-8 text-center text-slate-500">
                        No donations in this period
                      </div>
                    )}
                  </div>
                </div>

                {/* By Status */}
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="p-6 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-900">Donations by Status</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stats.byStatus.map((item) => (
                        <div key={item.status} className="p-4 bg-slate-50 rounded-lg">
                          <div className="mb-2">{getStatusBadge(item.status)}</div>
                          <p className="text-2xl font-bold text-slate-900">{item.count}</p>
                          <p className="text-sm text-slate-500">
                            ${(item.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Donations Tab */}
            {activeTab === "donations" && donations && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Donation History ({donations.total} total)
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Guest
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Charity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Reservation
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {donations.donations.map((donation) => (
                        <tr key={donation.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {new Date(donation.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-900">
                              {donation.reservation.guest.firstName} {donation.reservation.guest.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{donation.reservation.guest.email}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {donation.charity.name}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-pink-600">
                            ${(donation.amountCents / 100).toFixed(2)}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(donation.status)}</td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/reservations/${donation.reservation.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-mono"
                            >
                              {donation.reservation.id.slice(-8).toUpperCase()}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {donations.donations.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      No donations found in this period
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payouts Tab */}
            {activeTab === "payouts" && payouts && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Payout History ({payouts.total} total)
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Charity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Donations
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Paid Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payouts.payouts.map((payout) => (
                        <tr key={payout.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {new Date(payout.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {payout.charity.name}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-emerald-600">
                            ${(payout.amountCents / 100).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {payout._count.donations}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {payout.payoutDate
                              ? new Date(payout.payoutDate).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                            {payout.reference || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payouts.payouts.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      No payouts found
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
