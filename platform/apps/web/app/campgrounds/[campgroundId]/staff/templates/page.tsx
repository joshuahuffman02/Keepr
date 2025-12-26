"use client";

import { useEffect, useState } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
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

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    setProcessing(true);
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Copy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Schedule Templates</h1>
                <p className="text-slate-600">Create reusable weekly schedules</p>
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
              className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3"
            >
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span className="text-emerald-800">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
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
                className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <form onSubmit={handleSubmit} className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">
                    {editingId ? "Edit Template" : "Create Template"}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Template Name
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Summer Weekday Schedule"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description (optional)
                      </label>
                      <textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Notes about this template..."
                        rows={2}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-slate-700">
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
                        <p className="text-sm text-slate-500 text-center py-8 bg-slate-50 rounded-lg">
                          No shifts yet. Click "Add Shift" to get started.
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {formShifts.map((shift, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-slate-50 rounded-lg flex flex-wrap gap-3 items-center"
                            >
                              <select
                                value={shift.dayOfWeek}
                                onChange={(e) =>
                                  updateFormShift(idx, { dayOfWeek: parseInt(e.target.value) })
                                }
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                              >
                                {DAYS_OF_WEEK.map((day, i) => (
                                  <option key={i} value={i}>
                                    {day}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="time"
                                value={shift.startTime}
                                onChange={(e) => updateFormShift(idx, { startTime: e.target.value })}
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                              />
                              <span className="text-slate-400">to</span>
                              <input
                                type="time"
                                value={shift.endTime}
                                onChange={(e) => updateFormShift(idx, { endTime: e.target.value })}
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                              />

                              {roles.length > 0 && (
                                <select
                                  value={shift.roleCode || ""}
                                  onChange={(e) =>
                                    updateFormShift(idx, { roleCode: e.target.value || undefined })
                                  }
                                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                                >
                                  <option value="">No role</option>
                                  {roles.map((role) => (
                                    <option key={role.code} value={role.code}>
                                      {role.name}
                                    </option>
                                  ))}
                                </select>
                              )}

                              <select
                                value={shift.userId || ""}
                                onChange={(e) =>
                                  updateFormShift(idx, { userId: e.target.value || undefined })
                                }
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
                              >
                                <option value="">Unassigned</option>
                                {staffMembers.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.firstName} {member.lastName}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => removeFormShift(idx)}
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
                      className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No templates yet</h3>
            <p className="text-slate-500">
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
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    {/* Header */}
                    <div
                      className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Copy className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{template.name}</h3>
                            <p className="text-sm text-slate-500">
                              {template.shifts.length} shifts across{" "}
                              {Object.keys(shiftsByDay).length} days
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setApplyingTemplate(isApplying ? null : template.id);
                              if (!applyWeekStart) setApplyWeekStart(getNextSunday());
                            }}
                            className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 flex items-center gap-1"
                          >
                            <Play className="w-4 h-4" />
                            Apply
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(template);
                            }}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(template.id);
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {template.description && (
                        <p className="mt-2 text-sm text-slate-600 ml-14">{template.description}</p>
                      )}
                    </div>

                    {/* Apply form */}
                    <AnimatePresence>
                      {isApplying && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 bg-emerald-50/50 overflow-hidden"
                        >
                          <div className="p-4 flex items-center gap-4">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                Apply to week starting:
                              </label>
                              <input
                                type="date"
                                value={applyWeekStart}
                                onChange={(e) => setApplyWeekStart(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                              />
                            </div>
                            <button
                              onClick={() => handleApply(template.id)}
                              disabled={processing || !applyWeekStart}
                              className={cn(
                                "px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2",
                                "hover:bg-emerald-700",
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
                          className="border-t border-slate-100 overflow-hidden"
                        >
                          <div className="p-5 grid grid-cols-7 gap-2">
                            {DAYS_OF_WEEK.map((day, dayIdx) => {
                              const dayShifts = shiftsByDay[dayIdx] || [];
                              return (
                                <div key={dayIdx} className="text-center">
                                  <h4 className="text-xs font-semibold text-slate-500 mb-2">
                                    {SHORT_DAYS[dayIdx]}
                                  </h4>
                                  {dayShifts.length === 0 ? (
                                    <div className="p-2 bg-slate-50 rounded text-xs text-slate-400">
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
                                          <p className="text-slate-500 truncate">
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
    </DashboardShell>
  );
}
