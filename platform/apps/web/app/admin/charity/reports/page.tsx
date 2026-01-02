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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-success/15 text-status-success">
            <CheckCircle className="h-3 w-3" /> Collected
          </span>
        );
      case "pending_payout":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-warning/15 text-status-warning">
            <Clock className="h-3 w-3" /> Pending Payout
          </span>
        );
      case "paid_out":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-info/15 text-status-info">
            <DollarSign className="h-3 w-3" /> Paid Out
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-error/15 text-status-error">
            <AlertCircle className="h-3 w-3" /> Refunded
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-success/15 text-status-success">
            <CheckCircle className="h-3 w-3" /> Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin/charity"
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Charity Reports</h1>
              <p className="text-muted-foreground">Detailed donation analytics and payout tracking</p>
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-3 py-1.5 border border-border rounded-lg text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-1.5 border border-border rounded-lg text-sm"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border">
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
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
                  <div className="bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-pink-100 text-pink-600">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-muted-foreground">Total Raised</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      ${(stats.totalAmountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-status-success/15 text-status-success">
                        <Heart className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-muted-foreground">Total Donations</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {stats.totalDonations.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-status-info/15 text-status-info">
                        <Users className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-muted-foreground">Unique Donors</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {stats.donorCount.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-status-warning/15 text-status-warning">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-muted-foreground">Opt-in Rate</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {stats.optInRate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* By Charity */}
                <div className="bg-card rounded-xl border border-border">
                  <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">Donations by Charity</h2>
                  </div>
                  <div className="divide-y divide-border">
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
                          <span className="font-medium text-foreground">
                            {item.charity?.name || "Unknown Charity"}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            ${(item.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-muted-foreground">{item.count} donations</p>
                        </div>
                      </div>
                    ))}
                    {stats.byCharity.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        No donations in this period
                      </div>
                    )}
                  </div>
                </div>

                {/* By Status */}
                <div className="bg-card rounded-xl border border-border">
                  <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">Donations by Status</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stats.byStatus.map((item) => (
                        <div key={item.status} className="p-4 bg-muted rounded-lg">
                          <div className="mb-2">{getStatusBadge(item.status)}</div>
                          <p className="text-2xl font-bold text-foreground">{item.count}</p>
                          <p className="text-sm text-muted-foreground">
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
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    Donation History ({donations.total} total)
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Guest
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Charity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Reservation
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {donations.donations.map((donation) => (
                        <tr key={donation.id} className="hover:bg-muted">
                          <td className="px-6 py-4 text-sm text-foreground">
                            {new Date(donation.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-foreground">
                              {donation.reservation.guest.firstName} {donation.reservation.guest.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{donation.reservation.guest.email}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
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
                    <div className="p-12 text-center text-muted-foreground">
                      No donations found in this period
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payouts Tab */}
            {activeTab === "payouts" && payouts && (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    Payout History ({payouts.total} total)
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Charity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Donations
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Paid Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payouts.payouts.map((payout) => (
                        <tr key={payout.id} className="hover:bg-muted">
                          <td className="px-6 py-4 text-sm text-foreground">
                            {new Date(payout.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {payout.charity.name}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-status-success">
                            ${(payout.amountCents / 100).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {payout._count.donations}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {payout.payoutDate
                              ? new Date(payout.payoutDate).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                            {payout.reference || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payouts.payouts.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground">
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
