"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Search,
  User,
  Calendar,
  Shield,
  AlertTriangle,
  Loader2,
  FileText,
  Camera,
  Clock,
  CheckCircle2,
  Link as LinkIcon,
  ListTodo,
  X,
  ChevronRight,
  Stethoscope,
  Wrench,
  Eye,
  Leaf,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SPRING_CONFIG,
  fadeInUp,
  staggerContainer,
  staggerChild,
  reducedMotion as reducedMotionVariants,
} from "@/lib/animations";

type Incident = Awaited<ReturnType<typeof apiClient.createIncident>>;
type Guest = { id: string; primaryFirstName?: string; primaryLastName?: string; email?: string };
type Reservation = { id: string; arrivalDate?: string; departureDate?: string; guest?: Guest; site?: { name?: string } };

// Incident type configuration
const incidentTypes = [
  { value: "injury", label: "Injury", icon: <Stethoscope className="h-5 w-5" />, color: "text-red-600 dark:text-red-400" },
  { value: "property_damage", label: "Property Damage", icon: <Wrench className="h-5 w-5" />, color: "text-orange-600 dark:text-orange-400" },
  { value: "safety", label: "Safety Issue", icon: <AlertTriangle className="h-5 w-5" />, color: "text-yellow-600 dark:text-yellow-400" },
  { value: "near_miss", label: "Near Miss", icon: <Eye className="h-5 w-5" />, color: "text-blue-600 dark:text-blue-400" },
  { value: "environmental", label: "Environmental", icon: <Leaf className="h-5 w-5" />, color: "text-green-600 dark:text-green-400" },
  { value: "other", label: "Other", icon: <ClipboardList className="h-5 w-5" />, color: "text-slate-600 dark:text-slate-400" },
];

// Severity configuration
const severityConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  low: { color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/50", label: "Low" },
  medium: { color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/50", label: "Medium" },
  high: { color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/50", label: "High" },
  critical: { color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/50", label: "Critical" },
};

// Status configuration
const statusConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  open: { color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/50", icon: <AlertTriangle className="h-3 w-3" /> },
  investigating: { color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/50", icon: <Search className="h-3 w-3" /> },
  resolved: { color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/50", icon: <CheckCircle2 className="h-3 w-3" /> },
  closed: { color: "text-slate-700 dark:text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-800", icon: <CheckCircle2 className="h-3 w-3" /> },
};

export default function IncidentsPage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Guest/Reservation search states
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guestSearch, setGuestSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [showReservationDropdown, setShowReservationDropdown] = useState(false);

  const [form, setForm] = useState({
    type: "injury",
    severity: "",
    notes: "",
    reservationId: "",
    guestId: "",
  });

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [claimId, setClaimId] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [coiUrl, setCoiUrl] = useState("");
  const [coiExpiry, setCoiExpiry] = useState("");

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selected display names
  const selectedGuest = useMemo(() => guests.find(g => g.id === form.guestId), [guests, form.guestId]);
  const selectedReservation = useMemo(() => reservations.find(r => r.id === form.reservationId), [reservations, form.reservationId]);

  // Filtered lists
  const filteredGuests = useMemo(() => {
    if (!guestSearch.trim()) return guests.slice(0, 10);
    const q = guestSearch.toLowerCase();
    return guests.filter(g => {
      const name = `${g.primaryFirstName || ""} ${g.primaryLastName || ""}`.toLowerCase();
      return name.includes(q) || (g.email || "").toLowerCase().includes(q);
    }).slice(0, 10);
  }, [guests, guestSearch]);

  const filteredReservations = useMemo(() => {
    if (!reservationSearch.trim()) return reservations.slice(0, 10);
    const q = reservationSearch.toLowerCase();
    return reservations.filter(r => {
      const guestName = `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.toLowerCase();
      const siteName = (r.site?.name || "").toLowerCase();
      return guestName.includes(q) || siteName.includes(q) || r.id.toLowerCase().includes(q);
    }).slice(0, 10);
  }, [reservations, reservationSearch]);

  // Stats calculations
  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'investigating').length;
  const highPriorityIncidents = incidents.filter(i => i.severity === 'critical' || i.severity === 'high').length;

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const camps = await apiClient.getCampgrounds();
        const cg = camps[0];
        if (cg?.id) {
          setCampgroundId(cg.id);
          const [list, guestList, resList] = await Promise.all([
            apiClient.listIncidents(cg.id),
            apiClient.getGuests().catch(() => []),
            apiClient.getReservations(cg.id).catch(() => [])
          ]);
          setIncidents(list as Incident[]);
          setGuests(guestList as Guest[]);
          setReservations(resList as Reservation[]);
          if (list.length) setSelectedIncidentId(list[0].id);
        }
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const submitIncident = async () => {
    if (!campgroundId) return;
    setSubmitting(true);
    try {
      const created = await apiClient.createIncident({
        campgroundId,
        type: form.type,
        severity: form.severity || undefined,
        notes: form.notes || undefined,
        reservationId: form.reservationId || undefined,
        guestId: form.guestId || undefined,
      });
      setIncidents([created as Incident, ...incidents]);
      setSelectedIncidentId(created.id);
      setForm({ type: "injury", severity: "", notes: "", reservationId: "", guestId: "" });
    } finally {
      setSubmitting(false);
    }
  };

  const attachEvidence = async () => {
    if (!selectedIncidentId || !evidenceUrl) return;
    setActionLoading("evidence");
    try {
      await apiClient.addIncidentEvidence(selectedIncidentId, { url: evidenceUrl, type: "photo" });
      setEvidenceUrl("");
    } finally {
      setActionLoading(null);
    }
  };

  const linkClaim = async () => {
    if (!selectedIncidentId || !claimId) return;
    setActionLoading("claim");
    try {
      const updated = await apiClient.linkIncidentClaim(selectedIncidentId, { claimId });
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? (updated as Incident) : i)));
      setClaimId("");
    } finally {
      setActionLoading(null);
    }
  };

  const setReminder = async () => {
    if (!selectedIncidentId || !reminderAt) return;
    setActionLoading("reminder");
    try {
      const updated = await apiClient.setIncidentReminder(selectedIncidentId, { reminderAt });
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? (updated as Incident) : i)));
    } finally {
      setActionLoading(null);
    }
  };

  const addTask = async () => {
    if (!selectedIncidentId || !taskTitle) return;
    setActionLoading("task");
    try {
      await apiClient.createIncidentTask(selectedIncidentId, { title: taskTitle });
      setTaskTitle("");
    } finally {
      setActionLoading(null);
    }
  };

  const closeIncident = async () => {
    if (!selectedIncidentId) return;
    setActionLoading("close");
    try {
      const updated = await apiClient.closeIncident(selectedIncidentId, { resolutionNotes: "Closed from UI" });
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? (updated as Incident) : i)));
    } finally {
      setActionLoading(null);
    }
  };

  const attachCoi = async () => {
    if (!selectedIncidentId || !coiUrl) return;
    setActionLoading("coi");
    try {
      await apiClient.attachIncidentCoi(selectedIncidentId, {
        fileUrl: coiUrl,
        expiresAt: coiExpiry || undefined,
      });
      setCoiUrl("");
      setCoiExpiry("");
    } finally {
      setActionLoading(null);
    }
  };

  const fetchReport = async () => {
    if (!campgroundId) return;
    setReportLoading(true);
    try {
      const summary = await apiClient.getIncidentReport(campgroundId, "json");
      setReport(summary);
    } finally {
      setReportLoading(false);
    }
  };

  const getTypeConfig = (type: string) => incidentTypes.find(t => t.value === type) || incidentTypes[5];

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading incidents...</p>
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
        {/* Header */}
        <motion.div
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-status-error/15 flex items-center justify-center">
                <Shield className="h-5 w-5 text-status-error" />
              </div>
              Incidents
            </h1>
            <p className="text-muted-foreground mt-1">
              Log incidents, evidence, COIs, and follow-up tasks
            </p>
          </div>
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
                  <div className="text-3xl font-bold text-foreground">{incidents.length}</div>
                  <div className="text-sm text-muted-foreground">Total Incidents</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{openIncidents}</div>
                  <div className="text-sm text-muted-foreground">Open Cases</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{highPriorityIncidents}</div>
                  <div className="text-sm text-muted-foreground">High Priority</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Form Cards */}
        <motion.div
          className="grid gap-6 lg:grid-cols-2"
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          {/* New Incident Card */}
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Log New Incident
              </CardTitle>
              <CardDescription>Create and link to reservations or guests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Incident Type */}
              <div className="space-y-2">
                <Label className="text-foreground">Incident Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {incidentTypes.map((type) => (
                    <motion.button
                      key={type.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: type.value })}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-medium text-left",
                        form.type === type.value
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                      )}
                      whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    >
                      <span className={cn(form.type === type.value ? type.color : "text-muted-foreground")}>{type.icon}</span>
                      <span className={cn("flex-1", form.type === type.value ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                        {type.label}
                      </span>
                      {form.type === type.value && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label htmlFor="severity" className="text-foreground">Severity Level</Label>
                <Select value={form.severity} onValueChange={(value) => setForm({ ...form, severity: value })}>
                  <SelectTrigger id="severity" className="bg-background border-border">
                    <SelectValue placeholder="Select severity level" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(severityConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className={cn("flex items-center gap-2", config.color)}>
                          <span className={cn("w-2 h-2 rounded-full", config.bgColor)} />
                          {config.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notes" className="text-foreground">Description</Label>
                  <span className="text-xs text-muted-foreground">{form.notes.length}/500</span>
                </div>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 500) })}
                  className="bg-background border-border resize-none"
                  rows={3}
                  placeholder="Describe what happened, where, when, and who was involved..."
                />
              </div>

              {/* Reservation Selector */}
              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Reservation (optional)
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by guest name or site..."
                    value={form.reservationId ? `${selectedReservation?.guest?.primaryFirstName || ""} ${selectedReservation?.guest?.primaryLastName || ""} (${selectedReservation?.site?.name || "Site"})` : reservationSearch}
                    onChange={(e) => {
                      setReservationSearch(e.target.value);
                      setForm({ ...form, reservationId: "" });
                      setShowReservationDropdown(true);
                    }}
                    onFocus={() => setShowReservationDropdown(true)}
                    className="w-full pl-10 pr-8 py-2.5 border border-border bg-background rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                  {form.reservationId && (
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, reservationId: "" }); setReservationSearch(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {showReservationDropdown && !form.reservationId && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={SPRING_CONFIG}
                      className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      {filteredReservations.length > 0 ? filteredReservations.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, reservationId: r.id, guestId: r.guest?.id || form.guestId });
                            setShowReservationDropdown(false);
                            setReservationSearch("");
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-muted text-foreground text-sm border-b border-border last:border-b-0 transition-colors"
                        >
                          <div className="font-medium">{r.guest?.primaryFirstName} {r.guest?.primaryLastName}</div>
                          <div className="text-xs text-muted-foreground">{r.site?.name} · {r.arrivalDate?.slice(0, 10)} → {r.departureDate?.slice(0, 10)}</div>
                        </button>
                      )) : (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">No reservations found</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Guest Selector */}
              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Guest (optional)
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={form.guestId ? `${selectedGuest?.primaryFirstName || ""} ${selectedGuest?.primaryLastName || ""}` : guestSearch}
                    onChange={(e) => {
                      setGuestSearch(e.target.value);
                      setForm({ ...form, guestId: "" });
                      setShowGuestDropdown(true);
                    }}
                    onFocus={() => setShowGuestDropdown(true)}
                    className="w-full pl-10 pr-8 py-2.5 border border-border bg-background rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                  {form.guestId && (
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, guestId: "" }); setGuestSearch(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {showGuestDropdown && !form.guestId && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={SPRING_CONFIG}
                      className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      {filteredGuests.length > 0 ? filteredGuests.map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, guestId: g.id });
                            setShowGuestDropdown(false);
                            setGuestSearch("");
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-muted text-foreground text-sm border-b border-border last:border-b-0 transition-colors"
                        >
                          <div className="font-medium">{g.primaryFirstName} {g.primaryLastName}</div>
                          <div className="text-xs text-muted-foreground">{g.email}</div>
                        </button>
                      )) : (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">No guests found</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Button
                onClick={submitIncident}
                disabled={submitting || !campgroundId}
                className="w-full gap-2 bg-status-success hover:bg-status-success/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Incident...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Log Incident
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Incident Actions Card */}
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-muted-foreground" />
                Manage Incident
              </CardTitle>
              <CardDescription>Attach evidence, link claims, set reminders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Incident Selector */}
              <div className="space-y-2">
                <Label htmlFor="select-incident" className="text-foreground">Select Incident</Label>
                <Select value={selectedIncidentId} onValueChange={setSelectedIncidentId}>
                  <SelectTrigger id="select-incident" className="bg-background border-border">
                    <SelectValue placeholder={incidents.length ? "Select incident to manage" : "No incidents yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {incidents.map((i) => {
                      const typeConfig = getTypeConfig(i.type);
                      return (
                        <SelectItem key={i.id} value={i.id}>
                          <span className="flex items-center gap-2">
                            <span className={typeConfig.color}>{typeConfig.icon}</span>
                            <span className="capitalize">{i.type.replace('_', ' ')}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground capitalize">{i.status}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons Grid */}
              <div className="space-y-3">
                {/* Evidence */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Camera className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Evidence URL"
                      value={evidenceUrl}
                      onChange={(e) => setEvidenceUrl(e.target.value)}
                      className="pl-10 bg-background border-border"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={attachEvidence}
                    disabled={!selectedIncidentId || !evidenceUrl || actionLoading === "evidence"}
                    className="gap-2 shrink-0"
                  >
                    {actionLoading === "evidence" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    <span className="hidden sm:inline">Upload</span>
                  </Button>
                </div>

                {/* Claim */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Claim ID"
                      value={claimId}
                      onChange={(e) => setClaimId(e.target.value)}
                      className="pl-10 bg-background border-border"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={linkClaim}
                    disabled={!selectedIncidentId || !claimId || actionLoading === "claim"}
                    className="gap-2 shrink-0"
                  >
                    {actionLoading === "claim" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                    <span className="hidden sm:inline">Link</span>
                  </Button>
                </div>

                {/* Reminder */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="datetime-local"
                      value={reminderAt}
                      onChange={(e) => setReminderAt(e.target.value)}
                      className="pl-10 bg-background border-border"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={setReminder}
                    disabled={!selectedIncidentId || !reminderAt || actionLoading === "reminder"}
                    className="gap-2 shrink-0"
                  >
                    {actionLoading === "reminder" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                    <span className="hidden sm:inline">Set</span>
                  </Button>
                </div>

                {/* Task */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <ListTodo className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Follow-up task"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="pl-10 bg-background border-border"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={addTask}
                    disabled={!selectedIncidentId || !taskTitle || actionLoading === "task"}
                    className="gap-2 shrink-0"
                  >
                    {actionLoading === "task" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListTodo className="h-4 w-4" />}
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>

                {/* COI */}
                <div className="flex gap-2">
                  <Input
                    placeholder="COI file URL"
                    value={coiUrl}
                    onChange={(e) => setCoiUrl(e.target.value)}
                    className="bg-background border-border flex-1"
                  />
                  <Input
                    type="date"
                    value={coiExpiry}
                    onChange={(e) => setCoiExpiry(e.target.value)}
                    className="bg-background border-border w-36"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={attachCoi}
                    disabled={!selectedIncidentId || !coiUrl || actionLoading === "coi"}
                    className="flex-1 gap-2"
                  >
                    {actionLoading === "coi" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Attach COI
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={closeIncident}
                    disabled={!selectedIncidentId || actionLoading === "close"}
                    className="flex-1 gap-2"
                  >
                    {actionLoading === "close" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Close Incident
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom Section */}
        <motion.div
          className="grid gap-6 lg:grid-cols-2"
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          {/* Open Incidents */}
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Recent Incidents
              </CardTitle>
              <CardDescription>Click to select and manage</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {incidents.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4"
                    >
                      <Shield className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </motion.div>
                    <p className="text-lg font-medium text-foreground">All Clear!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      No incidents have been reported
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3 max-h-[400px] overflow-y-auto pr-2"
                  >
                    {incidents.map((incident, index) => {
                      const typeConfig = getTypeConfig(incident.type);
                      const severity = severityConfig[incident.severity || ""] || null;
                      const status = statusConfig[incident.status || "open"] || statusConfig.open;
                      const isSelected = selectedIncidentId === incident.id;

                      return (
                        <motion.div
                          key={incident.id}
                          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => setSelectedIncidentId(incident.id)}
                          className={cn(
                            "border-2 rounded-xl p-4 cursor-pointer transition-all",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md"
                              : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", typeConfig.color, "bg-muted")}>{typeConfig.icon}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-foreground capitalize">
                                    {incident.type.replace('_', ' ')}
                                  </span>
                                  {severity && (
                                    <Badge variant="outline" className={cn("text-xs", severity.bgColor, severity.color)}>
                                      {severity.label}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {incident.notes || <span className="italic">No description</span>}
                                </p>
                                {(incident.claimId || incident.reminderAt) && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {incident.claimId && (
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                        <LinkIcon className="h-3 w-3" />
                                        Claim: {incident.claimId}
                                      </span>
                                    )}
                                    {incident.reminderAt && (
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                        <Clock className="h-3 w-3" />
                                        Reminder set
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant="outline" className={cn("text-xs flex items-center gap-1", status.bgColor, status.color)}>
                                {status.icon}
                                <span className="capitalize">{incident.status}</span>
                              </Badge>
                              {isSelected && (
                                <ChevronRight className="h-4 w-4 text-emerald-500" />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Reporting */}
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Reporting
                </CardTitle>
                <CardDescription>Incident statistics and trends</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={fetchReport}
                disabled={!campgroundId || reportLoading}
                className="gap-2"
              >
                {reportLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {!report ? (
                  <motion.div
                    key="empty-report"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4"
                    >
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </motion.div>
                    <p className="text-lg font-medium text-foreground">Ready to Generate</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click refresh to view incident statistics
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="report"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">By Status</h4>
                      <div className="space-y-2">
                        {report.byStatus?.map((s: any) => (
                          <div key={s.status} className="flex items-center justify-between text-sm">
                            <span className="capitalize text-muted-foreground">{s.status}</span>
                            <span className="font-medium text-foreground">{s._count._all}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-border pt-4">
                      <h4 className="font-semibold text-foreground mb-2">By Type</h4>
                      <div className="space-y-2">
                        {report.byType?.map((t: any) => {
                          const typeConfig = getTypeConfig(t.type);
                          return (
                            <div key={t.type} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className={typeConfig.color}>{typeConfig.icon}</span>
                                <span className="capitalize text-muted-foreground">{t.type.replace('_', ' ')}</span>
                              </span>
                              <span className="font-medium text-foreground">{t._count._all}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <ListTodo className="h-4 w-4" />
                          Open Tasks
                        </span>
                        <span className="font-medium text-foreground">{report.openTasks}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}
