"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "../../../../lib/api-client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { ImageUpload } from "../../../../components/ui/image-upload";
import { useToast } from "../../../../components/ui/use-toast";
import { ToastAction } from "../../../../components/ui/toast";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Zap,
  Droplet,
  Waves,
  Trash2,
  Plus,
  Layers,
  DollarSign,
  Users,
  Loader2,
  Tent,
  Home,
  Trees,
  Sparkles,
  CheckCircle2,
  PawPrint,
  Accessibility,
  Truck,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Flame,
  Table2,
  TreeDeciduous,
  Cable,
  Wifi,
} from "lucide-react";
import { SITE_CLASS_AMENITIES } from "../../../../lib/amenities";
import { cn } from "../../../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";
import {
  SPRING_CONFIG,
  fadeInUp,
  staggerContainer,
  staggerChild,
  reducedMotion as reducedMotionVariants,
} from "../../../../lib/animations";

// Site type configuration with icons
const siteTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  rv: { icon: <Home className="h-4 w-4" />, label: "RV", color: "bg-status-info/15 text-status-info" },
  tent: { icon: <Tent className="h-4 w-4" />, label: "Tent", color: "bg-status-success/15 text-status-success" },
  cabin: { icon: <Home className="h-4 w-4" />, label: "Cabin", color: "bg-status-warning/15 text-status-warning" },
  group: { icon: <Users className="h-4 w-4" />, label: "Group", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400" },
  glamping: { icon: <Sparkles className="h-4 w-4" />, label: "Glamping", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400" },
};

type Site = {
  id: string;
  siteClassId?: string | null;
};

type SiteClass = {
  id: string;
  name: string;
  description?: string;
  defaultRate?: number;
  siteType: "rv" | "tent" | "cabin" | "group" | "glamping";
  maxOccupancy?: number;
  hookupsPower?: boolean;
  hookupsWater?: boolean;
  hookupsSewer?: boolean;
  amenityTags?: string[];
  isActive?: boolean;
  // Extended fields from onboarding
  rentalType?: string;
  rvOrientation?: string;
  electricAmps?: number[];
  equipmentTypes?: string[];
  slideOutsAccepted?: string | null;
  occupantsIncluded?: number;
  extraAdultFee?: number | null;
  extraChildFee?: number | null;
  meteredEnabled?: boolean;
  meteredType?: string;
};

type SiteClassFormState = {
  name: string;
  description: string;
  defaultRate: number | "";
  siteType: string;
  maxOccupancy: number | "";
  rigMaxLength: number | "";
  hookupsPower: boolean;
  hookupsWater: boolean;
  hookupsSewer: boolean;
  minNights: number | "";
  maxNights: number | "";
  petFriendly: boolean;
  accessible: boolean;
  photos: string;
  policyVersion: string;
  isActive: boolean;
};

const defaultClassForm: SiteClassFormState = {
  name: "",
  description: "",
  defaultRate: 0,
  siteType: "rv",
  maxOccupancy: 4,
  rigMaxLength: "",
  hookupsPower: false,
  hookupsWater: false,
  hookupsSewer: false,
  minNights: "",
  maxNights: "",
  petFriendly: true,
  accessible: false,
  photos: "",
  policyVersion: "",
  isActive: true
};

export default function SiteClassesPage() {
  const params = useParams();
  const router = useRouter();
  const campgroundId = params?.campgroundId as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });
  const classesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId
  });

  // Fetch sites to show counts per class
  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  // Count sites per class
  const sitesPerClass = useMemo(() => {
    if (!sitesQuery.data) return {};
    return sitesQuery.data.reduce((acc, site) => {
      const typedSite = site as Site;
      const classId = typedSite.siteClassId;
      if (classId) {
        acc[classId] = (acc[classId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [sitesQuery.data]);

  const [form, setForm] = useState<SiteClassFormState>(defaultClassForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SiteClassFormState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [inlineEditingRate, setInlineEditingRate] = useState<string | null>(null);
  const [inlineRateValue, setInlineRateValue] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; siteCount: number } | null>(null);
  const inlineRateInputRef = useRef<HTMLInputElement>(null);

  // Focus inline rate input when it becomes visible
  useEffect(() => {
    if (inlineEditingRate && inlineRateInputRef.current) {
      inlineRateInputRef.current.focus();
      inlineRateInputRef.current.select();
    }
  }, [inlineEditingRate]);

  const mapClassFormToPayload = (state: SiteClassFormState, opts?: { clearEmptyAsNull?: boolean }) => {
    const parseOptionalNumber = (value: number | "" | undefined | null) => {
      if (value === "" || value === undefined || value === null) {
        return opts?.clearEmptyAsNull ? null : undefined;
      }
      return Number(value);
    };
    return {
      name: state.name,
      description: state.description || undefined,
      defaultRate: Math.round(Number(state.defaultRate) * 100),
      siteType: state.siteType as "rv" | "tent" | "cabin" | "group" | "glamping",
      maxOccupancy: Number(state.maxOccupancy || 0),
      rigMaxLength: parseOptionalNumber(state.rigMaxLength),
      hookupsPower: state.hookupsPower,
      hookupsWater: state.hookupsWater,
      hookupsSewer: state.hookupsSewer,
      tags: [],
      minNights: parseOptionalNumber(state.minNights),
      maxNights: parseOptionalNumber(state.maxNights),
      petFriendly: state.petFriendly,
      accessible: state.accessible,
      photos: state.photos ? state.photos.split(",").map((p) => p.trim()) : opts?.clearEmptyAsNull ? [] : [],
      policyVersion: state.policyVersion ? state.policyVersion : opts?.clearEmptyAsNull ? null : undefined,
      isActive: state.isActive
    };
  };

  const createClass = useMutation({
    mutationFn: () =>
      apiClient.createSiteClass(campgroundId, mapClassFormToPayload(form)),
    onSuccess: () => {
      setForm(defaultClassForm);
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      toast({ title: "Site class created", description: "The new site class has been added." });
    }
  });
  const updateClass = useMutation({
    mutationFn: (payload: { id: string; data: ReturnType<typeof mapClassFormToPayload> }) =>
      apiClient.updateSiteClass(payload.id, payload.data, campgroundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      setEditingId(null);
      setEditForm(null);
      toast({ title: "Changes saved", description: "Site class has been updated." });
    }
  });
  const updateInlineRate = useMutation({
    mutationFn: (payload: { id: string; rate: number; previousRate: number; className: string }) =>
      apiClient.updateSiteClass(payload.id, { defaultRate: Math.round(payload.rate * 100) }, campgroundId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      setInlineEditingRate(null);
      const { id, previousRate, className } = variables;
      toast({
        title: "Rate updated",
        description: `${className} rate set to $${variables.rate.toFixed(2)}`,
        action: (
          <ToastAction altText="Undo" onClick={() => {
            apiClient.updateSiteClass(id, { defaultRate: Math.round(previousRate * 100) }, campgroundId).then(() => {
              queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
              toast({ title: "Undone", description: `Rate reverted to $${previousRate.toFixed(2)}` });
            });
          }}>
            Undo
          </ToastAction>
        ),
      });
    }
  });
  const deleteClass = useMutation({
    mutationFn: (id: string) => apiClient.deleteSiteClass(id, campgroundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      toast({ title: "Site class deleted", description: "The site class has been removed." });
    }
  });

  const handleInlineRateSave = (classId: string) => {
    const rate = parseFloat(inlineRateValue);
    const cls = classesQuery.data?.find(c => c.id === classId);
    if (!isNaN(rate) && rate >= 0 && cls) {
      updateInlineRate.mutate({
        id: classId,
        rate,
        previousRate: cls.defaultRate / 100,
        className: cls.name
      });
    } else {
      setInlineEditingRate(null);
    }
  };

  const handleDeleteClass = (id: string, name: string) => {
    const siteCount = sitesPerClass[id] || 0;
    setDeleteConfirm({ id, name, siteCount });
  };

  const confirmDeleteClass = () => {
    if (deleteConfirm) {
      deleteClass.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  // Stats
  const totalClasses = classesQuery.data?.length || 0;
  const activeClasses = classesQuery.data?.filter(c => c.isActive !== false).length || 0;
  const totalSitesWithClass = Object.values(sitesPerClass).reduce((a, b) => a + b, 0);

  if (classesQuery.isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading site classes...</p>
          </motion.div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: campgroundQuery.data?.name || campgroundId },
            { label: "Site Classes" }
          ]}
        />

        {/* Header */}
        <motion.div
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-status-info/15 flex items-center justify-center">
                <Layers className="h-5 w-5 text-status-info" />
              </div>
              Site Classes
            </h1>
            <p className="text-muted-foreground mt-1">
              Define pricing tiers and amenity packages for your sites
            </p>
          </div>
          {!showCreateForm && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="gap-2 bg-status-success text-white hover:bg-status-success/90"
            >
              <Plus className="h-4 w-4" />
              Add Class
            </Button>
          )}
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{totalClasses}</div>
                  <div className="text-sm text-muted-foreground">Total Classes</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Layers className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{activeClasses}</div>
                  <div className="text-sm text-muted-foreground">Active Classes</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-status-success/15 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-status-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{totalSitesWithClass}</div>
                  <div className="text-sm text-muted-foreground">Sites Assigned</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-status-info/15 flex items-center justify-center">
                  <Trees className="h-6 w-6 text-status-info" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_CONFIG}
            >
              <Card className="border-border bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-muted-foreground" />
                        Add Site Class
                      </CardTitle>
                      <CardDescription>Create a new pricing tier for your sites</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Essential fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-foreground">Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Premium Full Hookup"
                        value={form.name}
                        onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate" className="text-foreground">Default Rate ($) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="rate"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="45.00"
                          value={form.defaultRate}
                          onChange={(e) => setForm((s) => ({ ...s, defaultRate: e.target.value === "" ? "" : Number(e.target.value) }))}
                          className="pl-10 bg-background border-border"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type" className="text-foreground">Site Type</Label>
                      <Select value={form.siteType} onValueChange={(v) => setForm((s) => ({ ...s, siteType: v }))}>
                        <SelectTrigger id="type" className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(siteTypeConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-2">
                                {config.icon}
                                {config.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="occupancy" className="text-foreground">Max Guests</Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="occupancy"
                          type="number"
                          min="1"
                          placeholder="6"
                          value={form.maxOccupancy}
                          onChange={(e) => setForm((s) => ({ ...s, maxOccupancy: e.target.value === "" ? "" : Number(e.target.value) }))}
                          className="pl-10 bg-background border-border"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hookups */}
                  <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium text-foreground">Hookups:</span>
                    {[
                      { key: "hookupsPower", label: "Power", icon: <Zap className="h-4 w-4" />, color: "text-amber-500" },
                      { key: "hookupsWater", label: "Water", icon: <Droplet className="h-4 w-4" />, color: "text-blue-500" },
                      { key: "hookupsSewer", label: "Sewer", icon: <Waves className="h-4 w-4" />, color: "text-muted-foreground" },
                    ].map((hookup) => (
                      <motion.button
                        key={hookup.key}
                        type="button"
                        onClick={() => setForm((s) => ({ ...s, [hookup.key]: !s[hookup.key as keyof SiteClassFormState] }))}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all",
                          form[hookup.key as keyof SiteClassFormState]
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                        whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                        whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                      >
                        <span className={hookup.color}>{hookup.icon}</span>
                        <span className="text-sm text-foreground">{hookup.label}</span>
                        {form[hookup.key as keyof SiteClassFormState] && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                      </motion.button>
                    ))}
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium text-foreground">Features:</span>
                    <motion.button
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, petFriendly: !s.petFriendly }))}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all",
                        form.petFriendly
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                      whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    >
                      <PawPrint className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-foreground">Pet Friendly</span>
                      {form.petFriendly && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, accessible: !s.accessible }))}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all",
                        form.accessible
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                      whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    >
                      <Accessibility className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-foreground">Accessible</span>
                      {form.accessible && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </motion.button>
                  </div>

                  {/* Advanced Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showAdvanced ? "Hide" : "Show"} advanced options
                  </button>

                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pt-4 border-t border-border"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-foreground">Description</Label>
                          <Textarea
                            id="description"
                            placeholder="Describe what makes this class special..."
                            value={form.description}
                            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                            className="bg-background border-border"
                          />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label className="text-foreground">Min Nights</Label>
                            <Input
                              type="number"
                              min="1"
                              value={form.minNights}
                              onChange={(e) => setForm((s) => ({ ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                              className="bg-background border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-foreground">Max Nights</Label>
                            <Input
                              type="number"
                              min="1"
                              value={form.maxNights}
                              onChange={(e) => setForm((s) => ({ ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                              className="bg-background border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-foreground">Max Rig Length (ft)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={form.rigMaxLength}
                              onChange={(e) => setForm((s) => ({ ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) }))}
                              className="bg-background border-border"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm text-foreground h-10">
                              <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
                                className="rounded border-border"
                              />
                              Active
                            </label>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-foreground">Photos</Label>
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <ImageUpload
                              onChange={(url) => {
                                if (!url) return;
                                const current = form.photos ? form.photos.split(",").map(p => p.trim()).filter(Boolean) : [];
                                setForm(s => ({ ...s, photos: [...current, url].join(", ") }));
                              }}
                              placeholder="Upload class photo"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <Button
                      onClick={() => {
                        createClass.mutate(undefined, {
                          onSuccess: () => setShowCreateForm(false)
                        });
                      }}
                      disabled={createClass.isPending || !form.name}
                      className="gap-2"
                    >
                      {createClass.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Create Class
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                      Cancel
                    </Button>
                    {createClass.isError && <span className="text-sm text-red-500">Failed to save class</span>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Classes Grid */}
        <motion.div variants={staggerChild} transition={SPRING_CONFIG}>
          <AnimatePresence mode="wait">
            {classesQuery.data?.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="border-border bg-card/80 backdrop-blur-sm">
                  <CardContent className="py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-4"
                      >
                        <Layers className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      </motion.div>
                      <p className="text-lg font-medium text-foreground">No site classes yet</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Create your first site class to define pricing tiers and amenity packages
                      </p>
                      <Button
                        onClick={() => setShowCreateForm(true)}
                        className="mt-4 gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create First Class
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {classesQuery.data?.map((cls, index) => {
                  const typedCls = cls as SiteClass;
                  const typeConfig = siteTypeConfig[typedCls.siteType] || siteTypeConfig.rv;
                  const isInactive = typedCls.isActive === false;
                  const siteCount = sitesPerClass[typedCls.id] || 0;
                  const hasHookups = typedCls.hookupsPower || typedCls.hookupsWater || typedCls.hookupsSewer;

                  // Extended fields from onboarding
                  const rentalType = typedCls.rentalType || "transient";
                  const rvOrientation = typedCls.rvOrientation;
                  const electricAmps = typedCls.electricAmps;
                  const equipmentTypes = typedCls.equipmentTypes;
                  const slideOutsAccepted = typedCls.slideOutsAccepted;
                  const occupantsIncluded = typedCls.occupantsIncluded;
                  const extraAdultFee = typedCls.extraAdultFee;
                  const extraChildFee = typedCls.extraChildFee;
                  const meteredEnabled = typedCls.meteredEnabled;
                  const meteredType = typedCls.meteredType;
                  const amenityTags = typedCls.amenityTags;

                  const rentalTypeLabels: Record<string, string> = {
                    transient: "Nightly",
                    weekly: "Weekly",
                    monthly: "Monthly",
                    seasonal: "Seasonal",
                    annual: "Annual",
                  };

                  const orientationLabels: Record<string, { label: string; icon: React.ReactNode }> = {
                    "pull-through": { label: "Pull-Through", icon: <ArrowRight className="h-3 w-3" /> },
                    "back-in": { label: "Back-In", icon: <ArrowLeft className="h-3 w-3" /> },
                  };

                  return (
                    <motion.div
                      key={typedCls.id}
                      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={cn(
                        "border-border bg-card/80 backdrop-blur-sm transition-all hover:shadow-lg",
                        isInactive && "opacity-60"
                      )}>
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cn("text-xs flex items-center gap-1", typeConfig.color)}>
                                {typeConfig.icon}
                                {typeConfig.label}
                              </Badge>
                              {rentalType !== "transient" && (
                                <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400">
                                  {rentalTypeLabels[rentalType] || rentalType}
                                </Badge>
                              )}
                              {!typedCls.isActive && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/campgrounds/${campgroundId}/classes/${cls.id}`)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClass(cls.id, cls.name)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Name & Rate */}
                          <div className="mb-3">
                            <h3 className="font-semibold text-foreground text-lg">{cls.name}</h3>
                            {inlineEditingRate === cls.id ? (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-2xl font-bold text-emerald-600">$</span>
                                <input
                                  ref={inlineRateInputRef}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-20 text-2xl font-bold text-emerald-600 bg-transparent border-b-2 border-emerald-500 focus:outline-none"
                                  value={inlineRateValue}
                                  onChange={(e) => setInlineRateValue(e.target.value)}
                                  onBlur={() => handleInlineRateSave(cls.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleInlineRateSave(cls.id);
                                    if (e.key === "Escape") setInlineEditingRate(null);
                                  }}
                                />
                                <span className="text-sm text-muted-foreground">/night</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setInlineEditingRate(cls.id);
                                  setInlineRateValue((cls.defaultRate / 100).toFixed(2));
                                }}
                                className="flex items-center gap-1 group mt-1"
                              >
                                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                  ${(cls.defaultRate / 100).toFixed(0)}
                                </span>
                                <span className="text-sm text-muted-foreground">/night</span>
                                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>

                          {/* Description */}
                          {cls.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {cls.description}
                            </p>
                          )}

                          {/* RV Configuration (only for RV sites) */}
                          {cls.siteType === "rv" && (rvOrientation || (electricAmps && electricAmps.length > 0)) && (
                            <div className="flex flex-wrap gap-2 mb-3 p-2 rounded-lg bg-status-info/15">
                              {rvOrientation && orientationLabels[rvOrientation] && (
                                <div className="flex items-center gap-1 text-xs text-status-info">
                                  {orientationLabels[rvOrientation].icon}
                                  <span>{orientationLabels[rvOrientation].label}</span>
                                </div>
                              )}
                              {electricAmps && electricAmps.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-status-info">
                                  <Gauge className="h-3 w-3" />
                                  <span>{electricAmps.join("/")}A</span>
                                </div>
                              )}
                              {slideOutsAccepted && slideOutsAccepted !== "none" && (
                                <div className="flex items-center gap-1 text-xs text-status-info">
                                  <Truck className="h-3 w-3" />
                                  <span>Slide-outs: {slideOutsAccepted}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Features */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              {occupantsIncluded || cls.maxOccupancy} guests
                              {(extraAdultFee || extraChildFee) && (
                                <span className="text-[10px] text-muted-foreground">
                                  (+fees)
                                </span>
                              )}
                            </div>
                            {hasHookups && (
                              <div className="flex items-center gap-1">
                                {cls.hookupsPower && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                                {cls.hookupsWater && <Droplet className="h-3.5 w-3.5 text-blue-500" />}
                                {cls.hookupsSewer && <Waves className="h-3.5 w-3.5 text-muted-foreground" />}
                              </div>
                            )}
                            {meteredEnabled && (
                              <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                                <Gauge className="h-3.5 w-3.5" />
                                {meteredType === "electric" ? "Metered" : meteredType === "propane" ? "Propane" : "Metered"}
                              </div>
                            )}
                            {cls.petFriendly && <PawPrint className="h-3.5 w-3.5 text-orange-500" />}
                            {cls.accessible && <Accessibility className="h-3.5 w-3.5 text-blue-500" />}
                          </div>

                          {/* Amenity Tags */}
                          {amenityTags && amenityTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {amenityTags.slice(0, 4).map((tag) => {
                                const amenity = SITE_CLASS_AMENITIES.find((a) => a.id === tag);
                                if (!amenity) return null;
                                return (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-[10px] py-0 px-1.5 bg-muted text-muted-foreground"
                                  >
                                    {amenity.label}
                                  </Badge>
                                );
                              })}
                              {amenityTags.length > 4 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] py-0 px-1.5 bg-muted text-muted-foreground"
                                >
                                  +{amenityTags.length - 4} more
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Site Count */}
                          <div className="pt-3 border-t border-border">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Sites using this class</span>
                              <Badge variant="secondary" className="text-xs">
                                {siteCount}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"?
              {deleteConfirm?.siteCount && deleteConfirm.siteCount > 0 && (
                <span className="block mt-2 text-amber-600">
                  {deleteConfirm.siteCount} site{deleteConfirm.siteCount === 1 ? '' : 's'} will lose {deleteConfirm.siteCount === 1 ? 'its' : 'their'} class assignment.
                </span>
              )}
              <span className="block mt-2">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClass}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
