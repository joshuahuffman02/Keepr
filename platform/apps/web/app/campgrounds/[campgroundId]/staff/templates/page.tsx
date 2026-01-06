"use client";

import { useEffect, useState } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Plus,
  Trash2,
  Play,
  Calendar,
  Clock,
  Loader2,
  Sparkles,
  Inbox,
  Edit3,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RefreshCw,
  Settings2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

type TemplateShift = {
  dayOfWeek: number;
  roleCode?: string;
  startTime: string;
  endTime: string;
  userId?: string;
};

type ScheduleTemplate = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  isRecurring?: boolean;
  recurringDay?: number | null;
  recurringWeeksAhead?: number | null;
  lastAppliedAt?: string | null;
  shifts: TemplateShift[];
  createdAt: string;
  createdBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
};

type StaffMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
};

type StaffRole = {
  code: string;
  name: string;
};

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY_SELECT_VALUE = "__empty";

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

export default function ScheduleTemplatesPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [applyWeekStart, setApplyWeekStart] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formShifts, setFormShifts] = useState<TemplateShift[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Recurring scheduling state
  const [recurringTemplate, setRecurringTemplate] = useState<string | null>(null);
  const [recurringDay, setRecurringDay] = useState(0);
  const [recurringWeeksAhead, setRecurringWeeksAhead] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, membersRes, rolesRes] = await Promise.all([
        fetch(`/api/staff/templates?campgroundId=${params.campgroundId}`),
        fetch(`/api/campgrounds/${params.campgroundId}/members`),
        fetch(`/api/staff/roles?campgroundId=${params.campgroundId}`),
      ]);
      if (!templatesRes.ok) throw new Error("Failed to load templates");
      setTemplates(await templatesRes.json());
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setStaffMembers(membersData.members || membersData || []);
      }
      if (rolesRes.ok) {
        setRoles(await rolesRes.json());
      }
    } catch {
      setError("Could not load templates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [params.campgroundId]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormShifts([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (template: ScheduleTemplate) => {
    setFormName(template.name);
    setFormDescription(template.description || "");
    setFormShifts(template.shifts);
    setEditingId(template.id);
    setShowForm(true);
  };

  const addShiftToForm = () => {
    setFormShifts([
      ...formShifts,
      { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
    ]);
  };

  const updateFormShift = (index: number, updates: Partial<TemplateShift>) => {
    const newShifts = [...formShifts];
    newShifts[index] = { ...newShifts[index], ...updates };
    setFormShifts(newShifts);
  };

  const removeFormShift = (index: number) => {
    setFormShifts(formShifts.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whoami?.user?.id || !formName.trim() || formShifts.length === 0) return;

    setProcessing(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/staff/templates/${editingId}`
        : "/api/staff/templates";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundId: params.campgroundId,
          name: formName,
          description: formDescription || null,
          createdById: whoami.user.id,
          shifts: formShifts,
        }),
      });

      if (!res.ok) throw new Error("Failed to save template");
      setSuccessMessage(editingId ? "Template updated!" : "Template created!");
      resetForm();
      await loadTemplates();
    } catch {
      setError("Could not save template. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteConfirmId) return;

    setProcessing(true);
    const templateId = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      const res = await fetch(`/api/staff/templates/${templateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setSuccessMessage("Template deleted.");
      await loadTemplates();
    } catch {
      setError("Could not delete template.");
    } finally {
      setProcessing(false);
    }
  };

  const handleApply = async (templateId: string) => {
    if (!whoami?.user?.id || !applyWeekStart) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/staff/templates/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: applyWeekStart,
          createdBy: whoami.user.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to apply");
      const result = await res.json();
      setSuccessMessage(`Created ${result.count} shifts from template!`);
      setApplyingTemplate(null);
      setApplyWeekStart("");
    } catch {
      setError("Could not apply template.");
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleRecurring = async (templateId: string, enable: boolean) => {
    if (!enable) {
      // Disable recurring
      setProcessing(true);
      try {
        const res = await fetch(`/api/staff/templates/${templateId}/recurring`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRecurring: false }),
        });
        if (!res.ok) throw new Error("Failed to update");
        setSuccessMessage("Recurring scheduling disabled");
        await loadTemplates();
      } catch {
        setError("Could not update template.");
      } finally {
        setProcessing(false);
        setRecurringTemplate(null);
      }
    } else {
      // Show configuration
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setRecurringDay(template.recurringDay ?? 0);
        setRecurringWeeksAhead(template.recurringWeeksAhead ?? 1);
        setRecurringTemplate(templateId);
      }
    }
  };

  const handleSaveRecurring = async () => {
    if (!recurringTemplate) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/staff/templates/${recurringTemplate}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isRecurring: true,
          recurringDay,
          recurringWeeksAhead,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSuccessMessage("Recurring scheduling enabled!");
      await loadTemplates();
    } catch {
      setError("Could not save recurring settings.");
    } finally {
      setProcessing(false);
      setRecurringTemplate(null);
    }
  };

  const getStaffName = (userId?: string) => {
    if (!userId) return "Unassigned";
    const member = staffMembers.find((m) => m.id === userId);
    return member ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email : "Unknown";
  };

  const getRoleName = (roleCode?: string) => {
    if (!roleCode) return "";
    const role = roles.find((r) => r.code === roleCode);
    return role?.name || roleCode;
  };

  // Get next Sunday as default week start
  const getNextSunday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return nextSunday.toISOString().split("T")[0];
  };

  return (
    <DashboardShell>
      <StaffNavigation campgroundId={params.campgroundId} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Copy className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Schedule Templates</h1>
                <p className="text-muted-foreground">Create reusable weekly schedules</p>
              </div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        </motion.div>

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-6 p-4 bg-status-success/15 border border-status-success/30 rounded-xl flex items-center gap-3"
            >
              <Sparkles className="w-5 h-5 text-status-success" />
              <span className="text-status-success">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
          >
            {error}
          </motion.div>
        )}

        {/* Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={() => resetForm()}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <form onSubmit={handleSubmit} className="p-6">
                  <h2 className="text-xl font-bold text-foreground mb-6">
                    {editingId ? "Edit Template" : "Create Template"}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="template-name" className="block text-sm font-medium text-foreground mb-1">
                        Template Name
                      </Label>
                      <Input
                        id="template-name"
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Summer Weekday Schedule"
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="template-description" className="block text-sm font-medium text-foreground mb-1">
                        Description (optional)
                      </Label>
                      <Textarea
                        id="template-description"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Notes about this template..."
                        rows={2}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-foreground">
                          Shifts in Template
                        </label>
                        <button
                          type="button"
                          onClick={addShiftToForm}
                          className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Add Shift
                        </button>
                      </div>

                      {formShifts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8 bg-muted/60 rounded-lg">
                          No shifts yet. Click "Add Shift" to get started.
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {formShifts.map((shift, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-muted/60 rounded-lg flex flex-wrap gap-3 items-center"
                            >
                              <Select
                                value={String(shift.dayOfWeek)}
                                onValueChange={(value) =>
                                  updateFormShift(idx, { dayOfWeek: parseInt(value) })
                                }
                              >
                                <SelectTrigger
                                  className="h-8 w-[140px] text-sm"
                                  aria-label={`Day of week for shift ${idx + 1}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAYS_OF_WEEK.map((day, i) => (
                                    <SelectItem key={i} value={String(i)}>
                                      {day}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Input
                                type="time"
                                value={shift.startTime}
                                onChange={(e) => updateFormShift(idx, { startTime: e.target.value })}
                                aria-label={`Start time for shift ${idx + 1}`}
                                className="h-8 w-[120px] text-sm"
                              />
                              <span className="text-muted-foreground">to</span>
                              <Input
                                type="time"
                                value={shift.endTime}
                                onChange={(e) => updateFormShift(idx, { endTime: e.target.value })}
                                aria-label={`End time for shift ${idx + 1}`}
                                className="h-8 w-[120px] text-sm"
                              />

                              {roles.length > 0 && (
                                <Select
                                  value={shift.roleCode || EMPTY_SELECT_VALUE}
                                  onValueChange={(value) =>
                                    updateFormShift(idx, { roleCode: value === EMPTY_SELECT_VALUE ? undefined : value })
                                  }
                                >
                                  <SelectTrigger
                                    className="h-8 w-[140px] text-sm"
                                    aria-label={`Role for shift ${idx + 1}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={EMPTY_SELECT_VALUE}>No role</SelectItem>
                                    {roles.map((role) => (
                                      <SelectItem key={role.code} value={role.code}>
                                        {role.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              <Select
                                value={shift.userId || EMPTY_SELECT_VALUE}
                                onValueChange={(value) =>
                                  updateFormShift(idx, { userId: value === EMPTY_SELECT_VALUE ? undefined : value })
                                }
                              >
                                <SelectTrigger
                                  className="h-8 flex-1 min-w-[150px] text-sm"
                                  aria-label={`Staff member for shift ${idx + 1}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={EMPTY_SELECT_VALUE}>Unassigned</SelectItem>
                                  {staffMembers.map((member) => (
                                    <SelectItem key={member.id} value={member.id}>
                                      {member.firstName} {member.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <button
                                type="button"
                                onClick={() => removeFormShift(idx)}
                                aria-label={`Remove shift ${idx + 1}`}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-t">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processing || !formName.trim() || formShifts.length === 0}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2",
                        "bg-indigo-600 text-white hover:bg-indigo-700",
                        (processing || !formName.trim() || formShifts.length === 0) &&
                          "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {editingId ? "Update" : "Create"} Template
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recurring Configuration Modal */}
        <AnimatePresence>
          {recurringTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={() => setRecurringTemplate(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card rounded-2xl shadow-xl max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Auto-Schedule</h2>
                      <p className="text-sm text-muted-foreground">
                        Automatically apply this template every week
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="recurring-day" className="block text-sm font-medium text-foreground mb-1">
                        Run on
                      </Label>
                      <Select
                        value={String(recurringDay)}
                        onValueChange={(value) => setRecurringDay(parseInt(value))}
                      >
                        <SelectTrigger id="recurring-day" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day, i) => (
                            <SelectItem key={i} value={String(i)}>
                              Every {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        The template will be applied automatically on this day
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="recurring-weeks" className="block text-sm font-medium text-foreground mb-1">
                        Schedule for
                      </Label>
                      <Select
                        value={String(recurringWeeksAhead)}
                        onValueChange={(value) => setRecurringWeeksAhead(parseInt(value))}
                      >
                        <SelectTrigger id="recurring-weeks" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Next week</SelectItem>
                          <SelectItem value="2">2 weeks ahead</SelectItem>
                          <SelectItem value="3">3 weeks ahead</SelectItem>
                          <SelectItem value="4">4 weeks ahead</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        How far ahead to generate the schedule
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-t">
                    <button
                      onClick={() => setRecurringTemplate(null)}
                      className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRecurring}
                      disabled={processing}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2",
                        "bg-violet-600 text-white hover:bg-violet-700",
                        processing && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Enable Auto-Schedule
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : templates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No templates yet</h3>
            <p className="text-muted-foreground">
              Create a template to quickly generate weekly schedules
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Template
            </button>
          </motion.div>
        ) : (
          <motion.div layout className="space-y-4">
            <AnimatePresence mode="popLayout">
              {templates.map((template, idx) => {
                const isExpanded = expandedTemplate === template.id;
                const isApplying = applyingTemplate === template.id;
                const shiftsByDay = template.shifts.reduce(
                  (acc, shift) => {
                    if (!acc[shift.dayOfWeek]) acc[shift.dayOfWeek] = [];
                    acc[shift.dayOfWeek].push(shift);
                    return acc;
                  },
                  {} as Record<number, TemplateShift[]>
                );

                return (
                  <motion.div
                    key={template.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ ...SPRING_CONFIG, delay: idx * 0.05 }}
                    className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                  >
                    {/* Header */}
                    <div
                      className="p-5 cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Copy className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{template.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {template.shifts.length} shifts across{" "}
                              {Object.keys(shiftsByDay).length} days
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Recurring indicator */}
                          {template.isRecurring && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium">
                              <RefreshCw className="w-3 h-3" />
                              <span className="hidden sm:inline">
                                {DAYS_OF_WEEK[template.recurringDay ?? 0]?.slice(0, 3)}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setApplyingTemplate(isApplying ? null : template.id);
                              if (!applyWeekStart) setApplyWeekStart(getNextSunday());
                            }}
                            aria-expanded={isApplying}
                            aria-controls={`apply-template-${template.id}`}
                            aria-pressed={isApplying}
                            className="px-3 py-1.5 bg-status-success/15 text-status-success rounded-lg text-sm font-medium hover:bg-status-success/25 flex items-center gap-1"
                          >
                            <Play className="w-4 h-4" />
                            Apply
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRecurring(template.id, !template.isRecurring);
                            }}
                            aria-pressed={template.isRecurring}
                            aria-label={`${template.isRecurring ? "Disable" : "Enable"} auto-schedule for ${template.name}`}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1",
                              template.isRecurring
                                ? "bg-violet-600 text-white hover:bg-violet-700"
                                : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                            )}
                            title={template.isRecurring ? "Disable auto-schedule" : "Enable auto-schedule"}
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span className="hidden sm:inline">Auto</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(template);
                            }}
                            aria-label={`Edit template ${template.name}`}
                            className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(template.id);
                            }}
                            aria-label={`Delete template ${template.name}`}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {template.description && (
                        <p className="mt-2 text-sm text-muted-foreground ml-14">{template.description}</p>
                      )}
                    </div>

                    {/* Apply form */}
                    <AnimatePresence>
                      {isApplying && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          id={`apply-template-${template.id}`}
                          className="border-t border-border bg-status-success/10 overflow-hidden"
                        >
                          <div className="p-4 flex items-center gap-4">
                            <div className="flex-1">
                              <Label htmlFor={`apply-week-${template.id}`} className="block text-sm font-medium text-foreground mb-1">
                                Apply to week starting:
                              </Label>
                              <Input
                                id={`apply-week-${template.id}`}
                                type="date"
                                value={applyWeekStart}
                                onChange={(e) => setApplyWeekStart(e.target.value)}
                                className="px-3 py-2 border border-border rounded-lg text-sm w-full"
                              />
                            </div>
                            <button
                              onClick={() => handleApply(template.id)}
                              disabled={processing || !applyWeekStart}
                              className={cn(
                                "px-4 py-2 bg-status-success text-white rounded-lg font-medium flex items-center gap-2",
                                "hover:bg-status-success/90",
                                (processing || !applyWeekStart) && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {processing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Calendar className="w-4 h-4" />
                              )}
                              Generate Shifts
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Expanded view */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border overflow-hidden"
                        >
                          <div className="p-5 grid grid-cols-7 gap-2">
                            {DAYS_OF_WEEK.map((day, dayIdx) => {
                              const dayShifts = shiftsByDay[dayIdx] || [];
                              return (
                                <div key={dayIdx} className="text-center">
                                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                                    {SHORT_DAYS[dayIdx]}
                                  </h4>
                                  {dayShifts.length === 0 ? (
                                    <div className="p-2 bg-muted/60 rounded text-xs text-muted-foreground">
                                      -
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {dayShifts.map((shift, i) => (
                                        <div
                                          key={i}
                                          className="p-2 bg-indigo-50 rounded text-xs"
                                        >
                                          <p className="font-medium text-indigo-700">
                                            {shift.startTime}-{shift.endTime}
                                          </p>
                                          {shift.roleCode && (
                                            <p className="text-indigo-500">
                                              {getRoleName(shift.roleCode)}
                                            </p>
                                          )}
                                          <p className="text-muted-foreground truncate">
                                            {getStaffName(shift.userId)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
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
