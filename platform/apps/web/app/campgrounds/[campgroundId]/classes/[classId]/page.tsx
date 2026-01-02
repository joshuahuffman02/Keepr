"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DashboardShell } from "../../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { Textarea } from "../../../../../components/ui/textarea";
import { Switch } from "../../../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { useToast } from "../../../../../components/ui/use-toast";
import {
  ArrowLeft,
  Pencil,
  X,
  Save,
  Loader2,
  Zap,
  Droplet,
  Waves,
  PawPrint,
  Accessibility,
  Home,
  Tent,
  Users,
  Sparkles,
  DollarSign,
  Layers,
  Truck,
  Gauge,
  Cable,
  Flame,
  TreeDeciduous,
  Table2,
  Armchair,
  Sun,
  Square,
  Leaf,
  Wifi,
  Baby,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../../../../lib/utils";
import {
  SPRING_CONFIG,
  staggerContainer,
  staggerChild,
} from "../../../../../lib/animations";
import { SITE_CLASS_AMENITIES, CABIN_AMENITIES, getCabinAmenitiesByCategory } from "../../../../../lib/amenities";

// Site type configuration with icons
const siteTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  rv: { icon: <Truck className="h-4 w-4" />, label: "RV", color: "bg-status-info/15 text-status-info" },
  tent: { icon: <Tent className="h-4 w-4" />, label: "Tent", color: "bg-status-success/15 text-status-success" },
  cabin: { icon: <Home className="h-4 w-4" />, label: "Cabin", color: "bg-status-warning/15 text-status-warning" },
  group: { icon: <Users className="h-4 w-4" />, label: "Group", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400" },
  glamping: { icon: <Sparkles className="h-4 w-4" />, label: "Glamping", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400" },
};

// Rental type options
const rentalTypeOptions = [
  { value: "transient", label: "Transient (Nightly)" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "seasonal", label: "Seasonal" },
  { value: "annual", label: "Annual" },
];

// RV orientation options
const rvOrientationOptions = [
  { value: "back_in", label: "Back-in" },
  { value: "pull_through", label: "Pull-through" },
];

// Electric amp options
const electricAmpOptions = [15, 20, 30, 50, 100];

// Equipment type options
const equipmentTypeOptions = [
  { value: "motorhome_a", label: "Class A Motorhome" },
  { value: "motorhome_b", label: "Class B Motorhome" },
  { value: "motorhome_c", label: "Class C Motorhome" },
  { value: "travel_trailer", label: "Travel Trailer" },
  { value: "fifth_wheel", label: "Fifth Wheel" },
  { value: "popup", label: "Pop-up Camper" },
  { value: "truck_camper", label: "Truck Camper" },
  { value: "van", label: "Camper Van" },
];

// Slide-out options
const slideOutOptions = [
  { value: "any", label: "Any (No restrictions)" },
  { value: "one_side", label: "One side only" },
  { value: "both_sides", label: "Both sides allowed" },
  { value: "none", label: "No slide-outs" },
];

// Metered utility options
const meteredTypeOptions = [
  { value: "power", label: "Electric (kWh)" },
  { value: "water", label: "Water (gallons)" },
  { value: "propane", label: "Propane" },
];

const meteredBillingOptions = [
  { value: "per_reading", label: "Per Meter Reading" },
  { value: "per_night", label: "Flat Rate Per Night" },
];

// Amenity icon map
const amenityIconMap: Record<string, React.ReactNode> = {
  picnic_table: <Table2 className="h-4 w-4" />,
  fire_pit: <Flame className="h-4 w-4" />,
  patio: <Armchair className="h-4 w-4" />,
  bbq_grill: <Flame className="h-4 w-4" />,
  shade: <TreeDeciduous className="h-4 w-4" />,
  lake_view: <Waves className="h-4 w-4" />,
  river_view: <Waves className="h-4 w-4" />,
  concrete_pad: <Square className="h-4 w-4" />,
  grass_pad: <Leaf className="h-4 w-4" />,
  cable_tv: <Cable className="h-4 w-4" />,
  site_wifi: <Wifi className="h-4 w-4" />,
  covered: <Sun className="h-4 w-4" />,
};

type EditFormState = {
  name: string;
  description: string;
  defaultRate: number;
  siteType: string;
  maxOccupancy: number;
  rigMaxLength: number | "";
  hookupsPower: boolean;
  hookupsWater: boolean;
  hookupsSewer: boolean;
  minNights: number | "";
  maxNights: number | "";
  sameDayBookingCutoffMinutes: number | "" | null;
  petFriendly: boolean;
  accessible: boolean;
  isActive: boolean;
  // New fields
  rentalType: string;
  rvOrientation: string;
  electricAmps: number[];
  equipmentTypes: string[];
  slideOutsAccepted: string;
  occupantsIncluded: number;
  extraAdultFee: number | "";
  extraChildFee: number | "";
  meteredEnabled: boolean;
  meteredType: string;
  meteredBillingMode: string;
  amenityTags: string[];
};

type SiteClass = {
  id: string;
  name: string;
  description?: string;
  defaultRate: number;
  siteType: "rv" | "tent" | "cabin" | "group" | "glamping";
  maxOccupancy: number;
  rigMaxLength?: number | null;
  hookupsPower?: boolean;
  hookupsWater?: boolean;
  hookupsSewer?: boolean;
  minNights?: number | null;
  maxNights?: number | null;
  sameDayBookingCutoffMinutes?: number | null;
  petFriendly?: boolean;
  accessible?: boolean;
  isActive?: boolean;
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
  meteredBillingMode?: string;
  amenityTags?: string[];
  photos?: string[];
};

export default function SiteClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const campgroundId = params.campgroundId as string;
  const classId = params.classId as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const horizonIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const classQuery = useQuery({
    queryKey: ["site-class", classId],
    queryFn: () => apiClient.getSiteClass(classId, campgroundId),
    enabled: !!classId
  });

  const sitesQuery = useQuery({
    queryKey: ["campground-sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  const statusQuery = useQuery({
    queryKey: ["site-class-status", classId, todayIso, horizonIso],
    queryFn: () =>
      apiClient.getSitesWithStatus(campgroundId, {
        arrivalDate: todayIso,
        departureDate: horizonIso
      }),
    enabled: !!campgroundId && !!classId
  });

  const reservationsQuery = useQuery({
    queryKey: ["campground-reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId
  });

  const pricingRulesQuery = useQuery({
    queryKey: ["pricing-rules", campgroundId],
    queryFn: () => apiClient.getPricingRules(campgroundId),
    enabled: !!campgroundId
  });

  const auditLogsQuery = useQuery({
    queryKey: ["audit-logs", campgroundId],
    queryFn: () => apiClient.getAuditLogs(campgroundId, { limit: 50 }),
    enabled: !!campgroundId
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<EditFormState>) => {
      // Build the update payload, handling type conversions
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description,
        siteType: data.siteType as "rv" | "tent" | "cabin" | "group" | "glamping",
        defaultRate: data.defaultRate ? Math.round(data.defaultRate * 100) : undefined,
        maxOccupancy: data.maxOccupancy,
        rigMaxLength: data.rigMaxLength === "" ? null : data.rigMaxLength,
        minNights: data.minNights === "" ? null : data.minNights,
        maxNights: data.maxNights === "" ? null : data.maxNights,
        sameDayBookingCutoffMinutes: data.sameDayBookingCutoffMinutes === "" ? null : data.sameDayBookingCutoffMinutes,
        hookupsPower: data.hookupsPower,
        hookupsWater: data.hookupsWater,
        hookupsSewer: data.hookupsSewer,
        petFriendly: data.petFriendly,
        accessible: data.accessible,
        isActive: data.isActive,
        // New fields
        rentalType: data.rentalType,
        rvOrientation: data.rvOrientation,
        electricAmps: data.electricAmps,
        equipmentTypes: data.equipmentTypes,
        slideOutsAccepted: data.slideOutsAccepted === "any" ? null : data.slideOutsAccepted,
        occupantsIncluded: data.occupantsIncluded,
        extraAdultFee: data.extraAdultFee === "" ? null : data.extraAdultFee ? Math.round(Number(data.extraAdultFee) * 100) : null,
        extraChildFee: data.extraChildFee === "" ? null : data.extraChildFee ? Math.round(Number(data.extraChildFee) * 100) : null,
        meteredEnabled: data.meteredEnabled,
        meteredType: data.meteredType,
        meteredBillingMode: data.meteredBillingMode,
        amenityTags: data.amenityTags,
      };
      return apiClient.updateSiteClass(classId, payload, campgroundId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-class", classId] });
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      setIsEditing(false);
      setEditForm(null);
      toast({ title: "Class updated", description: "Changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update class.", variant: "destructive" });
    }
  });

  const classActivity = useMemo(() => {
    const logs = auditLogsQuery.data || [];
    return logs.filter((log: any) => log.entityId === classId).slice(0, 6);
  }, [auditLogsQuery.data, classId]);

  // Initialize edit form when entering edit mode
  const startEditing = () => {
    if (!classQuery.data) return;
    const sc = classQuery.data as SiteClass;
    setEditForm({
      name: sc.name || "",
      description: sc.description || "",
      defaultRate: (sc.defaultRate || 0) / 100,
      siteType: sc.siteType || "rv",
      maxOccupancy: sc.maxOccupancy || 4,
      rigMaxLength: sc.rigMaxLength ?? "",
      hookupsPower: !!sc.hookupsPower,
      hookupsWater: !!sc.hookupsWater,
      hookupsSewer: !!sc.hookupsSewer,
      minNights: sc.minNights ?? "",
      maxNights: sc.maxNights ?? "",
      sameDayBookingCutoffMinutes: sc.sameDayBookingCutoffMinutes ?? "",
      petFriendly: sc.petFriendly !== false,
      accessible: !!sc.accessible,
      isActive: sc.isActive !== false,
      // New fields
      rentalType: sc.rentalType || "transient",
      rvOrientation: sc.rvOrientation || "back_in",
      electricAmps: sc.electricAmps || [],
      equipmentTypes: sc.equipmentTypes || [],
      slideOutsAccepted: sc.slideOutsAccepted || "any",
      occupantsIncluded: sc.occupantsIncluded || 2,
      extraAdultFee: sc.extraAdultFee ? sc.extraAdultFee / 100 : "",
      extraChildFee: sc.extraChildFee ? sc.extraChildFee / 100 : "",
      meteredEnabled: !!sc.meteredEnabled,
      meteredType: sc.meteredType || "power",
      meteredBillingMode: sc.meteredBillingMode || "per_reading",
      amenityTags: sc.amenityTags || [],
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const saveChanges = () => {
    if (!editForm) return;
    updateMutation.mutate(editForm);
  };

  const toggleElectricAmp = (amp: number) => {
    if (!editForm) return;
    const current = editForm.electricAmps || [];
    const newAmps = current.includes(amp)
      ? current.filter(a => a !== amp)
      : [...current, amp].sort((a, b) => a - b);
    setEditForm({ ...editForm, electricAmps: newAmps });
  };

  const toggleEquipmentType = (type: string) => {
    if (!editForm) return;
    const current = editForm.equipmentTypes || [];
    const newTypes = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setEditForm({ ...editForm, equipmentTypes: newTypes });
  };

  const toggleAmenity = (id: string) => {
    if (!editForm) return;
    const current = editForm.amenityTags || [];
    const newTags = current.includes(id)
      ? current.filter(t => t !== id)
      : [...current, id];
    setEditForm({ ...editForm, amenityTags: newTags });
  };

  if (classQuery.isLoading) {
    return (
      <DashboardShell>
        <div className="flex h-80 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading class...</p>
          </motion.div>
        </div>
      </DashboardShell>
    );
  }

  const siteClass = classQuery.data as SiteClass;

  if (!siteClass) {
    return (
      <DashboardShell>
        <div className="flex h-80 flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Layers className="h-8 w-8" />
          </div>
          <div>Site class not found</div>
          <Button onClick={() => router.push(`/campgrounds/${campgroundId}/classes`)}>Back to classes</Button>
        </div>
      </DashboardShell>
    );
  }

  const sitesInClass = (sitesQuery.data || []).filter((s) => s.siteClassId === classId);
  const statusBySite = Object.fromEntries((statusQuery.data || []).map((s) => [s.id, s]));
  const photoList = (siteClass.photos || []).filter(Boolean);

  const upcomingReservations = (reservationsQuery.data || [])
    .filter((res: any) => {
      const resClassId =
        res.siteClassId || res.site?.siteClassId || res.site?.siteClass?.id || res.site?.siteClass?.siteClassId;
      return resClassId === classId && new Date(res.departureDate) >= new Date();
    })
    .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime())
    .slice(0, 6);

  const classPricingRules = (pricingRulesQuery.data || []).filter(
    (rule: any) => !rule.siteClassId || rule.siteClassId === classId
  );

  const typeConfig = siteTypeConfig[siteClass.siteType] || siteTypeConfig.rv;

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: `Campground ${campgroundId}`, href: `/campgrounds/${campgroundId}` },
            { label: "Site Classes", href: `/campgrounds/${campgroundId}/classes` },
            { label: siteClass.name }
          ]}
        />

        {/* Header */}
        <motion.div
          variants={staggerChild}
          transition={SPRING_CONFIG}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", typeConfig.color)}>
                {typeConfig.icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{siteClass.name}</h1>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Badge variant="secondary" className={cn("gap-1", typeConfig.color)}>
                    {typeConfig.icon}
                    {typeConfig.label}
                  </Badge>
                  <span>•</span>
                  <span>Max {siteClass.maxOccupancy} guests</span>
                  {siteClass.rentalType && siteClass.rentalType !== "transient" && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="capitalize">{siteClass.rentalType}</Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={siteClass.isActive ? "default" : "outline"} className={siteClass.isActive ? "bg-status-success/15 text-status-success" : ""}>
              {siteClass.isActive ? "Active" : "Inactive"}
            </Badge>
            {!isEditing ? (
              <Button onClick={startEditing} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={cancelEditing} disabled={updateMutation.isPending}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button onClick={saveChanges} disabled={updateMutation.isPending} className="gap-2 bg-status-success text-white hover:bg-status-success/90">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Edit Form */}
        <AnimatePresence>
          {isEditing && editForm && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={SPRING_CONFIG}
              className="space-y-4"
            >
              {/* Basic Info */}
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-emerald-600" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Site Type</Label>
                      <Select
                        value={editForm.siteType}
                        onValueChange={(value) => setEditForm({ ...editForm, siteType: value })}
                      >
                        <SelectTrigger className="bg-background">
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
                      <Label>Rental Type</Label>
                      <Select
                        value={editForm.rentalType}
                        onValueChange={(value) => setEditForm({ ...editForm, rentalType: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {rentalTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Default Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.defaultRate}
                        onChange={(e) => setEditForm({ ...editForm, defaultRate: parseFloat(e.target.value) || 0 })}
                        className="bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Max Occupancy</Label>
                      <Input
                        type="number"
                        value={editForm.maxOccupancy}
                        onChange={(e) => setEditForm({ ...editForm, maxOccupancy: parseInt(e.target.value) || 1 })}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rig Max Length (ft)</Label>
                      <Input
                        type="number"
                        value={editForm.rigMaxLength}
                        onChange={(e) => setEditForm({ ...editForm, rigMaxLength: e.target.value === "" ? "" : parseInt(e.target.value) })}
                        placeholder="No limit"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Nights</Label>
                      <Input
                        type="number"
                        value={editForm.minNights}
                        onChange={(e) => setEditForm({ ...editForm, minNights: e.target.value === "" ? "" : parseInt(e.target.value) })}
                        placeholder="No minimum"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Nights</Label>
                      <Input
                        type="number"
                        value={editForm.maxNights}
                        onChange={(e) => setEditForm({ ...editForm, maxNights: e.target.value === "" ? "" : parseInt(e.target.value) })}
                        placeholder="No maximum"
                        className="bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Same-Day Booking Cutoff</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={editForm.sameDayBookingCutoffMinutes ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, sameDayBookingCutoffMinutes: e.target.value === "" ? "" : parseInt(e.target.value) })}
                          placeholder={editForm.siteType === "rv" || editForm.siteType === "tent" ? "0" : "60"}
                          className="bg-background w-24"
                        />
                        <span className="text-sm text-muted-foreground">minutes before office close</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {editForm.siteType === "rv" || editForm.siteType === "tent"
                          ? "Default: No cutoff (RV/tent sites can book anytime)"
                          : "Default: 60 minutes (cabin/lodging need prep time)"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* RV Configuration - Only show for RV sites */}
              {editForm.siteType === "rv" && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-blue-600" />
                      RV Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Orientation</Label>
                        <Select
                          value={editForm.rvOrientation}
                          onValueChange={(value) => setEditForm({ ...editForm, rvOrientation: value })}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rvOrientationOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Slide-outs</Label>
                        <Select
                          value={editForm.slideOutsAccepted}
                          onValueChange={(value) => setEditForm({ ...editForm, slideOutsAccepted: value })}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {slideOutOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Electric Amps Available</Label>
                      <div className="flex flex-wrap gap-2">
                        {electricAmpOptions.map((amp) => (
                          <button
                            key={amp}
                            type="button"
                            onClick={() => toggleElectricAmp(amp)}
                            className={cn(
                              "px-4 py-2 rounded-lg border transition-all flex items-center gap-2",
                              editForm.electricAmps?.includes(amp)
                                ? "border-amber-500 bg-status-warning/15 text-status-warning"
                                : "border-border bg-background hover:border-amber-300"
                            )}
                          >
                            <Zap className="h-4 w-4" />
                            {amp}A
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Accepted Equipment Types</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {equipmentTypeOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleEquipmentType(opt.value)}
                            className={cn(
                              "px-3 py-2 rounded-lg border text-sm transition-all text-left",
                              editForm.equipmentTypes?.includes(opt.value)
                                ? "border-blue-500 bg-status-info/15 text-status-info"
                                : "border-border bg-background hover:border-blue-300"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Leave empty to allow all types</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Hookups & Features */}
              <Card className="border-border bg-card/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Hookups & Features
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm">Power</span>
                      </div>
                      <Switch
                        checked={editForm.hookupsPower}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, hookupsPower: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2">
                        <Droplet className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Water</span>
                      </div>
                      <Switch
                        checked={editForm.hookupsWater}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, hookupsWater: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2">
                        <Waves className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Sewer</span>
                      </div>
                      <Switch
                        checked={editForm.hookupsSewer}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, hookupsSewer: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2">
                        <PawPrint className="h-4 w-4 text-amber-600" />
                        <span className="text-sm">Pets</span>
                      </div>
                      <Switch
                        checked={editForm.petFriendly}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, petFriendly: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2">
                        <Accessibility className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">ADA</span>
                      </div>
                      <Switch
                        checked={editForm.accessible}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, accessible: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                      <span className="text-sm">Active</span>
                      <Switch
                        checked={editForm.isActive}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showAdvanced ? "Hide" : "Show"} advanced options (Guest Pricing, Metered Utilities, Amenities)
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={SPRING_CONFIG}
                    className="space-y-4"
                  >
                    {/* Guest Pricing */}
                    <Card className="border-border bg-card/80">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-purple-500" />
                          Guest Pricing
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Guests Included in Base Rate</Label>
                            <Input
                              type="number"
                              min="1"
                              value={editForm.occupantsIncluded}
                              onChange={(e) => setEditForm({ ...editForm, occupantsIncluded: parseInt(e.target.value) || 1 })}
                              className="bg-background"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Extra Adult Fee ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.extraAdultFee}
                              onChange={(e) => setEditForm({ ...editForm, extraAdultFee: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                              placeholder="No extra fee"
                              className="bg-background"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Extra Child Fee ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.extraChildFee}
                              onChange={(e) => setEditForm({ ...editForm, extraChildFee: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                              placeholder="No extra fee"
                              className="bg-background"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Metered Utilities */}
                    <Card className="border-border bg-card/80">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Gauge className="h-5 w-5 text-orange-500" />
                          Metered Utilities
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                          <div>
                            <span className="font-medium">Enable Metered Billing</span>
                            <p className="text-xs text-muted-foreground">Charge guests based on utility usage</p>
                          </div>
                          <Switch
                            checked={editForm.meteredEnabled}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, meteredEnabled: checked })}
                          />
                        </div>

                        {editForm.meteredEnabled && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Utility Type</Label>
                              <Select
                                value={editForm.meteredType}
                                onValueChange={(value) => setEditForm({ ...editForm, meteredType: value })}
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {meteredTypeOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Billing Mode</Label>
                              <Select
                                value={editForm.meteredBillingMode}
                                onValueChange={(value) => setEditForm({ ...editForm, meteredBillingMode: value })}
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {meteredBillingOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Site Amenities */}
                    <Card className="border-border bg-card/80">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Flame className="h-5 w-5 text-orange-500" />
                          Site Amenities
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {SITE_CLASS_AMENITIES.map((amenity) => (
                            <button
                              key={amenity.id}
                              type="button"
                              onClick={() => toggleAmenity(amenity.id)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                                editForm.amenityTags?.includes(amenity.id)
                                  ? "border-emerald-500 bg-status-success/15 text-status-success"
                                  : "border-border bg-background hover:border-emerald-300"
                              )}
                            >
                              {amenityIconMap[amenity.id] || <amenity.icon className="h-4 w-4" />}
                              <span className="truncate">{amenity.label}</span>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Cabin/Glamping Amenities - only show for cabin or glamping types */}
                    {(editForm.siteType === "cabin" || editForm.siteType === "glamping") && (
                      <Card className="border-border bg-card/80">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Home className="h-5 w-5 text-amber-500" />
                            {editForm.siteType === "cabin" ? "Cabin" : "Glamping"} Amenities
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {Object.entries(getCabinAmenitiesByCategory()).map(([category, amenities]) => (
                            <div key={category}>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                {category === "sleeping" ? "Sleeping" :
                                 category === "bathroom" ? "Bathroom" :
                                 category === "kitchen" ? "Kitchen" :
                                 category === "climate" ? "Climate Control" :
                                 category === "entertainment" ? "Entertainment" :
                                 category === "laundry" ? "Laundry" :
                                 category === "outdoor" ? "Outdoor" : category}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {amenities.map((amenity) => (
                                  <button
                                    key={amenity.id}
                                    type="button"
                                    onClick={() => toggleAmenity(amenity.id)}
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                                      editForm.amenityTags?.includes(amenity.id)
                                        ? "border-amber-500 bg-status-warning/15 text-status-warning"
                                        : "border-border bg-background hover:border-amber-300"
                                    )}
                                  >
                                    <amenity.icon className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{amenity.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Description */}
                    <Card className="border-border bg-card/80">
                      <CardHeader>
                        <CardTitle>Description</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="Optional description for this site class..."
                          className="bg-background min-h-[100px]"
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Grid - View Mode */}
        {!isEditing && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <motion.div variants={staggerChild} transition={SPRING_CONFIG}>
                <Card className="border-border bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-emerald-500" />
                      Pricing & Capacity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Default rate</div>
                      <div className="font-medium text-lg text-emerald-600 dark:text-emerald-400">${((siteClass.defaultRate ?? 0) / 100).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Rental type</div>
                      <div className="font-medium capitalize">{siteClass.rentalType || "Transient"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Max occupancy</div>
                      <div className="font-medium">{siteClass.maxOccupancy} guests</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Guests included</div>
                      <div className="font-medium">{siteClass.occupantsIncluded || 2}</div>
                    </div>
                    {siteClass.extraAdultFee && (
                      <div>
                        <div className="text-xs text-muted-foreground">Extra adult fee</div>
                        <div className="font-medium">${(siteClass.extraAdultFee / 100).toFixed(2)}</div>
                      </div>
                    )}
                    {siteClass.extraChildFee && (
                      <div>
                        <div className="text-xs text-muted-foreground">Extra child fee</div>
                        <div className="font-medium">${(siteClass.extraChildFee / 100).toFixed(2)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-muted-foreground">Min nights</div>
                      <div className="font-medium">{siteClass.minNights ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Max nights</div>
                      <div className="font-medium">{siteClass.maxNights ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Same-day cutoff</div>
                      <div className="font-medium">
                        {siteClass.sameDayBookingCutoffMinutes != null
                          ? `${siteClass.sameDayBookingCutoffMinutes} min before close`
                          : siteClass.siteType === "glamping"
                            ? "60 min (default)"
                            : "No cutoff"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* RV Config - only show for RV sites */}
              {siteClass.siteType === "rv" && (
                <motion.div variants={staggerChild} transition={SPRING_CONFIG}>
                  <Card className="border-border bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-blue-500" />
                        RV Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Orientation</span>
                        <span className="font-medium capitalize">{siteClass.rvOrientation?.replace("_", "-") || "Back-in"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Electric amps</span>
                        <div className="flex gap-1">
                          {(() => {
                            const amps = siteClass.electricAmps || [];
                            return amps.length > 0 ? (
                              amps.map((amp: number) => (
                                <Badge key={amp} variant="secondary" className="gap-1">
                                  <Zap className="h-3 w-3 text-amber-500" />
                                  {amp}A
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Rig max length</span>
                        <span className="font-medium">{siteClass.rigMaxLength ? `${siteClass.rigMaxLength} ft` : "No limit"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Slide-outs</span>
                        <span className="font-medium capitalize">{siteClass.slideOutsAccepted?.replace("_", " ") || "Any"}</span>
                      </div>
                      {(() => {
                        const types = siteClass.equipmentTypes || [];
                        return types.length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <div className="text-xs text-muted-foreground mb-2">Accepted equipment</div>
                            <div className="flex flex-wrap gap-1">
                              {types.map((type: string) => (
                                <Badge key={type} variant="outline" className="text-xs capitalize">
                                  {type.replace("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <motion.div variants={staggerChild} transition={SPRING_CONFIG}>
                <Card className="border-border bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Hookups & Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {siteClass.hookupsPower && (
                        <Badge variant="secondary" className="gap-1">
                          <Zap className="h-3 w-3 text-amber-500" /> Power
                        </Badge>
                      )}
                      {siteClass.hookupsWater && (
                        <Badge variant="secondary" className="gap-1">
                          <Droplet className="h-3 w-3 text-blue-500" /> Water
                        </Badge>
                      )}
                      {siteClass.hookupsSewer && (
                        <Badge variant="secondary" className="gap-1">
                          <Waves className="h-3 w-3 text-muted-foreground" /> Sewer
                        </Badge>
                      )}
                      {siteClass.petFriendly && (
                        <Badge variant="secondary" className="gap-1">
                          <PawPrint className="h-3 w-3 text-amber-600" /> Pet Friendly
                        </Badge>
                      )}
                      {siteClass.accessible && (
                        <Badge variant="secondary" className="gap-1">
                          <Accessibility className="h-3 w-3 text-blue-600" /> Accessible
                        </Badge>
                      )}
                      {siteClass.meteredEnabled && (
                        <Badge variant="secondary" className="gap-1">
                          <Gauge className="h-3 w-3 text-orange-500" /> Metered {siteClass.meteredType}
                        </Badge>
                      )}
                      {!siteClass.hookupsPower && !siteClass.hookupsWater && !siteClass.hookupsSewer && !siteClass.petFriendly && !siteClass.accessible && !siteClass.meteredEnabled && (
                        <span className="text-muted-foreground text-sm">None configured</span>
                      )}
                    </div>

                    {/* Site Amenities */}
                    {(() => {
                      const tags = siteClass.amenityTags || [];
                      return tags.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="text-xs text-muted-foreground mb-2">Site Amenities</div>
                          <div className="flex flex-wrap gap-2">
                            {tags.map((tag: string) => {
                              const amenity = SITE_CLASS_AMENITIES.find(a => a.id === tag) || CABIN_AMENITIES.find(a => a.id === tag);
                              const isCabinAmenity = CABIN_AMENITIES.some(a => a.id === tag);
                              return (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className={cn(
                                    "gap-1",
                                    isCabinAmenity && "border-amber-300 bg-amber-50 dark:bg-amber-900/20"
                                  )}
                                >
                                  {amenityIconMap[tag]}
                                  {amenity?.label || tag}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={staggerChild} transition={SPRING_CONFIG}>
                <Card className="border-border bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Sites in this class ({sitesInClass.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm max-h-[250px] overflow-y-auto">
                    {sitesQuery.isLoading && <div className="text-muted-foreground">Loading sites...</div>}
                    {sitesInClass.length === 0 && !sitesQuery.isLoading && (
                      <div className="text-muted-foreground">No sites assigned to this class.</div>
                    )}
                    {sitesInClass.slice(0, 8).map((s) => {
                      const status = statusBySite[s.id];
                      return (
                        <div key={s.id} className="rounded-lg border border-border bg-muted/50 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-foreground">
                              {s.name || `Site #${s.siteNumber}`}
                            </div>
                            {status ? (
                              <Badge
                                variant={status.status === "available" ? "outline" : "default"}
                                className={cn(
                                  "capitalize text-xs",
                                  status.status === "available" && "border-emerald-500 text-emerald-600"
                                )}
                              >
                                {status.status}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {sitesInClass.length > 8 && (
                      <div className="text-xs text-muted-foreground text-center pt-2">
                        + {sitesInClass.length - 8} more sites
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Upcoming Reservations */}
            <motion.div variants={staggerChild} transition={SPRING_CONFIG}>
              <Card className="border-border bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Upcoming Reservations</CardTitle>
                </CardHeader>
                <CardContent>
                  {reservationsQuery.isLoading && <div className="text-muted-foreground">Loading...</div>}
                  {upcomingReservations.length === 0 && !reservationsQuery.isLoading && (
                    <div className="text-muted-foreground">No upcoming stays for this class.</div>
                  )}
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {upcomingReservations.map((res) => (
                      <div key={res.id} className="rounded-lg border border-border bg-muted/50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-foreground">
                            {res.guest ? `${res.guest.primaryFirstName} ${res.guest.primaryLastName}` : "Guest"}
                          </div>
                          <Badge variant="outline" className="capitalize text-xs">{res.status.replace("_", " ")}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {res.arrivalDate} → {res.departureDate}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>
    </DashboardShell>
  );
}
