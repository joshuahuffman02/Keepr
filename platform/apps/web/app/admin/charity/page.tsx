"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  Plus,
  Search,
  Edit,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Users,
  TrendingUp,
  Building2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Charity {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  taxId: string | null;
  website: string | null;
  category: string | null;
  isActive: boolean;
  isVerified: boolean;
  _count: {
    campgroundCharities: number;
    donations: number;
  };
}

interface PlatformStats {
  totalDonations: number;
  totalAmountCents: number;
  donorCount: number;
  optInRate: number;
  averageDonationCents: number;
  byCharity: {
    charity: { id: string; name: string; logoUrl: string | null };
    count: number;
    amountCents: number;
  }[];
}

const CATEGORIES = [
  { value: "environment", label: "Environment & Conservation" },
  { value: "youth", label: "Youth & Education" },
  { value: "veterans", label: "Veterans & Military" },
  { value: "animals", label: "Animals & Wildlife" },
  { value: "health", label: "Health & Medical" },
  { value: "community", label: "Community & Local" },
  { value: "disaster", label: "Disaster Relief" },
  { value: "other", label: "Other" },
];

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
};

export default function CharityAdminPage() {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCharity, setEditingCharity] = useState<Charity | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logoUrl: "",
    taxId: "",
    website: "",
    category: "",
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchCharities = async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("activeOnly", "false");

      const res = await fetch(`/api/charity?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCharities(data);
      }
    } catch (error) {
      console.error("Failed to fetch charities:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/charity/stats/platform");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCharities(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, [categoryFilter]);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/charity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setFormData({ name: "", description: "", logoUrl: "", taxId: "", website: "", category: "" });
        fetchCharities();
      }
    } catch (error) {
      console.error("Failed to create charity:", error);
    }
  };

  const handleUpdate = async () => {
    if (!editingCharity) return;

    try {
      const res = await fetch(`/api/charity/${editingCharity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setEditingCharity(null);
        setFormData({ name: "", description: "", logoUrl: "", taxId: "", website: "", category: "" });
        fetchCharities();
      }
    } catch (error) {
      console.error("Failed to update charity:", error);
    }
  };

  const confirmDeleteCharity = async () => {
    if (!deleteConfirmId) return;

    try {
      const res = await fetch(`/api/charity/${deleteConfirmId}`, { method: "DELETE" });
      if (res.ok) {
        fetchCharities();
      }
    } catch (error) {
      console.error("Failed to delete charity:", error);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openEdit = (charity: Charity) => {
    setEditingCharity(charity);
    setFormData({
      name: charity.name,
      description: charity.description || "",
      logoUrl: charity.logoUrl || "",
      taxId: charity.taxId || "",
      website: charity.website || "",
      category: charity.category || "",
    });
  };

  const filteredCharities = charities.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-400" />
            Charity Round-Up
          </h1>
          <p className="text-slate-400 mt-1">
            Manage charities and track donations across the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/charity/reports">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <FileText className="h-4 w-4 mr-2" />
              View Reports
            </Button>
          </Link>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-rose-600 hover:bg-rose-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Charity
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-success/15 rounded-lg">
                <DollarSign className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Raised</p>
                <p className="text-2xl font-bold text-white">
                  {stats ? formatCurrency(stats.totalAmountCents) : "$0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-info/15 rounded-lg">
                <Users className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Donors</p>
                <p className="text-2xl font-bold text-white">
                  {stats?.donorCount.toLocaleString() ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Donation</p>
                <p className="text-2xl font-bold text-white">
                  {stats ? formatCurrency(stats.averageDonationCents) : "$0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-warning/15 rounded-lg">
                <Building2 className="h-5 w-5 text-status-warning" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Active Charities</p>
                <p className="text-2xl font-bold text-white">
                  {charities.filter((c) => c.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Charities by Donations */}
      {stats && stats.byCharity.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Top Charities by Donations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byCharity.slice(0, 5).map((item, idx) => (
                <div key={item.charity.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-sm w-6">{idx + 1}.</span>
                    {item.charity.logoUrl ? (
                      <img
                        src={item.charity.logoUrl}
                        alt={item.charity.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                        <Heart className="h-4 w-4 text-rose-400" />
                      </div>
                    )}
                    <span className="text-white">{item.charity.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{formatCurrency(item.amountCents)}</p>
                    <p className="text-xs text-slate-400">{item.count} donations</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search charities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Charities List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading charities...</div>
        ) : filteredCharities.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No charities found. Add one to get started.
          </div>
        ) : (
          filteredCharities.map((charity) => (
            <Card key={charity.id} className={`bg-slate-800 border-slate-700 ${!charity.isActive ? "opacity-60" : ""}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {charity.logoUrl ? (
                      <img
                        src={charity.logoUrl}
                        alt={charity.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-rose-500/20 flex items-center justify-center">
                        <Heart className="h-6 w-6 text-rose-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{charity.name}</h3>
                        {charity.isVerified && (
                          <Badge className="bg-green-600/20 text-green-400 border-green-600/50">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                        {!charity.isActive && (
                          <Badge className="bg-red-600/20 text-red-400 border-red-600/50">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {charity.description && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                          {charity.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {charity.category && (
                          <span className="capitalize">{charity.category.replace("_", " ")}</span>
                        )}
                        {charity.taxId && <span>EIN: {charity.taxId}</span>}
                        {charity.website && (
                          <a
                            href={charity.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:underline"
                          >
                            Website <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-400">
                        {charity._count.campgroundCharities} campgrounds
                      </p>
                      <p className="text-sm text-slate-400">
                        {charity._count.donations} donations
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(charity)}
                        className="text-slate-400 hover:text-white"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {charity.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(charity.id)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingCharity} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingCharity(null);
          setFormData({ name: "", description: "", logoUrl: "", taxId: "", website: "", category: "" });
        }
      }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCharity ? "Edit Charity" : "Add New Charity"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Charity name"
                className="mt-1 bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the charity's mission"
                className="mt-1 bg-slate-900 border-slate-700"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="mt-1 bg-slate-900 border-slate-700">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tax ID (EIN)</Label>
                <Input
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  placeholder="XX-XXXXXXX"
                  className="mt-1 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.org"
                className="mt-1 bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://example.org/logo.png"
                className="mt-1 bg-slate-900 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingCharity(null);
              }}
              className="border-slate-600"
            >
              Cancel
            </Button>
            <Button
              onClick={editingCharity ? handleUpdate : handleCreate}
              disabled={!formData.name}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {editingCharity ? "Save Changes" : "Add Charity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deactivate Charity</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to deactivate this charity? This action can be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCharity}
              className="bg-red-600 hover:bg-red-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
