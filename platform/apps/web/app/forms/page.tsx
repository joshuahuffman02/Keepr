"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Checkbox } from "../../components/ui/checkbox";
import { apiClient } from "../../lib/api-client";
import { useToast } from "../../components/ui/use-toast";
import {
  FileText, Plus, Sparkles, Shield, Car, ClipboardList,
  FileQuestion, Eye, Trash2, Edit3, PartyPopper, CheckCircle2,
  AlertTriangle, PawPrint, Loader2, ChevronUp, Settings2,
  ChevronDown, Type, Hash, CheckSquare, List, AlignLeft, Phone, Mail, X,
  Calendar, Clock, Send, Users, Zap, Link2, Bell, RefreshCw, Search
} from "lucide-react";
import { cn } from "../../lib/utils";

// Question types with friendly labels
const questionTypes = [
  { value: "text", label: "Short text", icon: Type, description: "Single line answer" },
  { value: "textarea", label: "Long text", icon: AlignLeft, description: "Multi-line answer" },
  { value: "number", label: "Number", icon: Hash, description: "Numeric input" },
  { value: "checkbox", label: "Agreement", icon: CheckSquare, description: "Yes/No checkbox" },
  { value: "select", label: "Dropdown", icon: List, description: "Choose from options" },
  { value: "phone", label: "Phone", icon: Phone, description: "Phone number" },
  { value: "email", label: "Email", icon: Mail, description: "Email address" },
];

type Question = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

type FormTemplateInput = {
  title: string;
  type: "waiver" | "vehicle" | "intake" | "custom";
  description: string;
  questions: Question[];
  isActive: boolean;
  // Settings
  autoAttachMode: "manual" | "all_bookings" | "site_classes";
  siteClassIds: string[];
  showAt: string[];
  isRequired: boolean;
  allowSkipWithNote: boolean;
  validityDays: number | null;
  sendReminder: boolean;
  reminderDaysBefore: number | null;
};

const emptyForm: FormTemplateInput = {
  title: "",
  type: "waiver",
  description: "",
  questions: [],
  isActive: true,
  autoAttachMode: "manual",
  siteClassIds: [],
  showAt: ["during_booking"],
  isRequired: true,
  allowSkipWithNote: false,
  validityDays: null,
  sendReminder: false,
  reminderDaysBefore: 1,
};

// Generate unique ID for questions
const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Starter templates
const starterTemplates: {
  name: string;
  icon: React.ReactNode;
  type: FormTemplateInput["type"];
  description: string;
  questions: Question[];
  autoAttachMode: FormTemplateInput["autoAttachMode"];
  showAt: string[];
}[] = [
  {
    name: "Liability Waiver",
    icon: <Shield className="h-5 w-5" />,
    type: "waiver",
    description: "Standard liability and assumption of risk waiver",
    autoAttachMode: "all_bookings",
    showAt: ["during_booking"],
    questions: [
      { id: generateId(), label: "I acknowledge the inherent risks of camping activities", type: "checkbox", required: true },
      { id: generateId(), label: "Emergency contact name", type: "text", required: true },
      { id: generateId(), label: "Emergency contact phone", type: "phone", required: true },
      { id: generateId(), label: "Any medical conditions we should know about?", type: "textarea", required: false },
    ]
  },
  {
    name: "Vehicle Registration",
    icon: <Car className="h-5 w-5" />,
    type: "vehicle",
    description: "Collect RV/vehicle details for registration",
    autoAttachMode: "site_classes",
    showAt: ["during_booking", "at_checkin"],
    questions: [
      { id: generateId(), label: "Vehicle type", type: "select", options: ["RV/Motorhome", "Travel Trailer", "Fifth Wheel", "Tent", "Car/Truck"], required: true },
      { id: generateId(), label: "Vehicle length (feet)", type: "number", required: true },
      { id: generateId(), label: "License plate number", type: "text", required: true },
      { id: generateId(), label: "License plate state", type: "text", required: true },
    ]
  },
  {
    name: "Pet Policy",
    icon: <PawPrint className="h-5 w-5" />,
    type: "intake",
    description: "Pet information and agreement",
    autoAttachMode: "manual",
    showAt: ["at_checkin"],
    questions: [
      { id: generateId(), label: "Pet type", type: "select", options: ["Dog", "Cat", "Other"], required: true },
      { id: generateId(), label: "Pet breed", type: "text", required: true },
      { id: generateId(), label: "Pet name", type: "text", required: true },
      { id: generateId(), label: "Is your pet up to date on vaccinations?", type: "checkbox", required: true },
      { id: generateId(), label: "I agree to keep my pet on a leash at all times", type: "checkbox", required: true },
    ]
  },
  {
    name: "Custom Form",
    icon: <FileQuestion className="h-5 w-5" />,
    type: "custom",
    description: "Start from scratch with your own questions",
    autoAttachMode: "manual",
    showAt: ["on_demand"],
    questions: []
  },
];

// Form type icons
const typeIcons: Record<string, React.ReactNode> = {
  waiver: <Shield className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
  intake: <ClipboardList className="h-4 w-4" />,
  custom: <FileQuestion className="h-4 w-4" />,
};

// Show At options
const showAtOptions = [
  { value: "during_booking", label: "During online booking", icon: Calendar, description: "Guest fills out before payment" },
  { value: "at_checkin", label: "At check-in", icon: Clock, description: "Staff collects during check-in" },
  { value: "after_booking", label: "After booking (email)", icon: Send, description: "Sent via email after confirmation" },
  { value: "on_demand", label: "On demand only", icon: Users, description: "Only when manually requested" },
];

// Visual Question Builder Component
function QuestionBuilder({
  questions,
  onChange
}: {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}) {
  const addQuestion = () => {
    onChange([
      ...questions,
      { id: generateId(), label: "", type: "text", required: false }
    ]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter(q => q.id !== id));
  };

  const moveQuestion = (id: string, direction: "up" | "down") => {
    const index = questions.findIndex(q => q.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[swapIndex]] = [newQuestions[swapIndex], newQuestions[index]];
    onChange(newQuestions);
  };

  const addOption = (questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    if (!q) return;
    updateQuestion(questionId, { options: [...(q.options || []), ""] });
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const q = questions.find(q => q.id === questionId);
    if (!q || !q.options) return;
    const newOptions = [...q.options];
    newOptions[optionIndex] = value;
    updateQuestion(questionId, { options: newOptions });
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const q = questions.find(q => q.id === questionId);
    if (!q || !q.options) return;
    updateQuestion(questionId, { options: q.options.filter((_, i) => i !== optionIndex) });
  };

  const getTypeIcon = (type: string) => {
    const t = questionTypes.find(qt => qt.value === type);
    return t ? <t.icon className="h-4 w-4" /> : <Type className="h-4 w-4" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-900">Questions</label>
        <span className="text-xs text-slate-500">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <FileQuestion className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-600 mb-3">No questions yet</p>
          <Button size="sm" variant="outline" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" />
            Add your first question
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, index) => (
            <div
              key={q.id}
              className={cn(
                "rounded-lg border border-slate-200 bg-white p-3",
                "transition-all duration-200 hover:border-slate-300"
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(q.id, "up")}
                    disabled={index === 0}
                    className={cn(
                      "p-0.5 rounded hover:bg-slate-100 transition-colors",
                      index === 0 && "opacity-30 cursor-not-allowed"
                    )}
                    aria-label="Move question up"
                  >
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(q.id, "down")}
                    disabled={index === questions.length - 1}
                    className={cn(
                      "p-0.5 rounded hover:bg-slate-100 transition-colors",
                      index === questions.length - 1 && "opacity-30 cursor-not-allowed"
                    )}
                    aria-label="Move question down"
                  >
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={q.label}
                      onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                      placeholder="Enter your question..."
                      className="flex-1"
                    />
                    <Select
                      value={q.type}
                      onValueChange={(value) => updateQuestion(q.id, { type: value, options: value === "select" ? ["Option 1"] : undefined })}
                    >
                      <SelectTrigger className="w-[140px]">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(q.type)}
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4 text-slate-500" />
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {q.type === "select" && (
                    <div className="pl-4 border-l-2 border-slate-100 space-y-1.5">
                      <div className="text-xs text-slate-500 font-medium">Dropdown options:</div>
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400 w-4">{optIdx + 1}.</span>
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                            placeholder={`Option ${optIdx + 1}`}
                            className="h-8 text-sm flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(q.id, optIdx)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            aria-label="Remove option"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add option
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={q.required}
                        onCheckedChange={(checked) => updateQuestion(q.id, { required: checked })}
                        id={`required-${q.id}`}
                      />
                      <label htmlFor={`required-${q.id}`} className="text-xs text-slate-600">
                        Required
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="Delete question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <Button size="sm" variant="outline" onClick={addQuestion} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          Add question
        </Button>
      )}
    </div>
  );
}

// Form Settings Component
function FormSettings({
  form,
  onChange,
  siteClasses
}: {
  form: FormTemplateInput;
  onChange: (updates: Partial<FormTemplateInput>) => void;
  siteClasses: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-6">
      {/* Auto-Attach Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <label className="text-sm font-medium text-slate-900">Auto-attach to bookings</label>
        </div>
        <div className="grid gap-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              name="autoAttachMode"
              checked={form.autoAttachMode === "manual"}
              onChange={() => onChange({ autoAttachMode: "manual", siteClassIds: [] })}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm text-slate-900">Manual only</div>
              <div className="text-xs text-slate-500">Only attach when you manually select it</div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              name="autoAttachMode"
              checked={form.autoAttachMode === "all_bookings"}
              onChange={() => onChange({ autoAttachMode: "all_bookings", siteClassIds: [] })}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm text-slate-900">All bookings</div>
              <div className="text-xs text-slate-500">Automatically attach to every booking</div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              name="autoAttachMode"
              checked={form.autoAttachMode === "site_classes"}
              onChange={() => onChange({ autoAttachMode: "site_classes" })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900">Specific site types</div>
              <div className="text-xs text-slate-500">Only for selected accommodation types</div>
            </div>
          </label>
        </div>

        {/* Site Class Selection */}
        {form.autoAttachMode === "site_classes" && (
          <div className="ml-6 p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
            <div className="text-xs font-medium text-slate-700">Select site types:</div>
            {siteClasses.length === 0 ? (
              <div className="text-xs text-slate-500">No site types found. Create site classes first.</div>
            ) : (
              <div className="grid gap-1.5">
                {siteClasses.map((sc) => (
                  <label key={sc.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.siteClassIds.includes(sc.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChange({ siteClassIds: [...form.siteClassIds, sc.id] });
                        } else {
                          onChange({ siteClassIds: form.siteClassIds.filter(id => id !== sc.id) });
                        }
                      }}
                    />
                    <span className="text-sm text-slate-700">{sc.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Show At Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <label className="text-sm font-medium text-slate-900">When to show this form</label>
        </div>
        <div className="grid gap-2">
          {showAtOptions.map((option) => (
            <label key={option.value} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <Checkbox
                checked={form.showAt.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange({ showAt: [...form.showAt, option.value] });
                  } else {
                    onChange({ showAt: form.showAt.filter(v => v !== option.value) });
                  }
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <option.icon className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-sm text-slate-900">{option.label}</span>
                </div>
                <div className="text-xs text-slate-500">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Required Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <label className="text-sm font-medium text-slate-900">Completion requirements</label>
        </div>
        <div className="space-y-3 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">Required to complete</div>
              <div className="text-xs text-slate-500">Guest must fill out this form</div>
            </div>
            <Switch
              checked={form.isRequired}
              onCheckedChange={(checked) => onChange({ isRequired: checked })}
            />
          </div>
          {form.isRequired && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <div className="text-sm font-medium text-slate-900">Allow skip with note</div>
                <div className="text-xs text-slate-500">Guest can skip but must provide reason</div>
              </div>
              <Switch
                checked={form.allowSkipWithNote}
                onCheckedChange={(checked) => onChange({ allowSkipWithNote: checked })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Validity Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-purple-500" />
          <label className="text-sm font-medium text-slate-900">Form validity</label>
        </div>
        <div className="space-y-3 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">Expires after</div>
              <div className="text-xs text-slate-500">Require re-signing after period</div>
            </div>
            <Select
              value={form.validityDays?.toString() || "never"}
              onValueChange={(v) => onChange({ validityDays: v === "never" ? null : parseInt(v) })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never expires</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">6 months</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Reminder Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-orange-500" />
          <label className="text-sm font-medium text-slate-900">Reminders</label>
        </div>
        <div className="space-y-3 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">Send email reminder</div>
              <div className="text-xs text-slate-500">Remind guests to complete before arrival</div>
            </div>
            <Switch
              checked={form.sendReminder}
              onCheckedChange={(checked) => onChange({ sendReminder: checked })}
            />
          </div>
          {form.sendReminder && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-sm text-slate-700">Days before check-in</div>
              <Select
                value={form.reminderDaysBefore?.toString() || "1"}
                onValueChange={(v) => onChange({ reminderDaysBefore: parseInt(v) })}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="2">2 days</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Manual Attach Component
function ManualAttach({
  templates,
  campgroundId,
  onAttach
}: {
  templates: any[];
  campgroundId: string;
  onAttach: (templateId: string, reservationId?: string, guestId?: string) => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [searchType, setSearchType] = useState<"reservation" | "guest">("reservation");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  // Fetch reservations for search
  const reservationsQuery = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId && searchType === "reservation",
  });

  // Fetch guests for search
  const guestsQuery = useQuery({
    queryKey: ["guests", campgroundId],
    queryFn: () => apiClient.getGuests(campgroundId),
    enabled: !!campgroundId && searchType === "guest",
  });

  const filteredResults = searchType === "reservation"
    ? (reservationsQuery.data || []).filter((r: any) =>
        r.confirmationNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.guest?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.guest?.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10)
    : (guestsQuery.data || []).filter((g: any) =>
        g.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.email?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="h-5 w-5 text-slate-400" />
        <h3 className="font-semibold text-slate-900">Attach form manually</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Select Form */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Select form</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a form..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    {typeIcons[t.type]}
                    {t.title}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Attach to</label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={searchType === "reservation" ? "default" : "outline"}
              onClick={() => { setSearchType("reservation"); setSearchQuery(""); setSelectedId(""); }}
              className="flex-1"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Reservation
            </Button>
            <Button
              type="button"
              size="sm"
              variant={searchType === "guest" ? "default" : "outline"}
              onClick={() => { setSearchType("guest"); setSearchQuery(""); setSelectedId(""); }}
              className="flex-1"
            >
              <Users className="h-4 w-4 mr-1" />
              Guest
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          {searchType === "reservation" ? "Search reservations" : "Search guests"}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchType === "reservation" ? "Search by confirmation # or guest name..." : "Search by name or email..."}
            className="pl-10"
          />
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {filteredResults.length === 0 ? (
              <div className="p-3 text-sm text-slate-500 text-center">No results found</div>
            ) : (
              filteredResults.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-slate-50 transition-colors",
                    selectedId === item.id && "bg-emerald-50"
                  )}
                >
                  {searchType === "reservation" ? (
                    <div>
                      <div className="font-medium text-sm text-slate-900">
                        #{item.confirmationNumber} - {item.guest?.firstName} {item.guest?.lastName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-sm text-slate-900">
                        {item.firstName} {item.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{item.email}</div>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Attach Button */}
      <Button
        onClick={() => {
          if (selectedTemplate && selectedId) {
            onAttach(
              selectedTemplate,
              searchType === "reservation" ? selectedId : undefined,
              searchType === "guest" ? selectedId : undefined
            );
            setSelectedTemplate("");
            setSearchQuery("");
            setSelectedId("");
          }
        }}
        disabled={!selectedTemplate || !selectedId}
        className="w-full"
      >
        <Link2 className="h-4 w-4 mr-2" />
        Attach form
      </Button>
    </div>
  );
}

// Loading skeleton
function FormCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

// Celebration modal
function FirstFormCelebration({ open, onClose, formName }: { open: boolean; onClose: () => void; formName: string; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in duration-300 max-w-md mx-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white mb-4 motion-safe:animate-bounce">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Your First Form is Ready!</h3>
        <p className="text-slate-600 mb-6">
          <span className="font-medium text-emerald-600">{formName}</span> is now available.
        </p>
        <Button onClick={onClose} className="bg-gradient-to-r from-emerald-500 to-teal-500">Got it!</Button>
      </div>
    </div>
  );
}

// Form preview modal
function FormPreview({ open, onClose, form }: { open: boolean; onClose: () => void; form: any; }) {
  if (!form) return null;
  const questions = form.fields?.questions || [];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-slate-400" />
            Preview: {form.title}
          </DialogTitle>
        </DialogHeader>
        <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
          <div className="text-center pb-3 border-b">
            <h3 className="font-semibold">{form.title}</h3>
            {form.description && <p className="text-sm text-slate-600 mt-1">{form.description}</p>}
          </div>
          {questions.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">No questions</div>
          ) : (
            questions.map((q: any, idx: number) => (
              <div key={idx} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {q.label}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {q.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" disabled className="h-4 w-4" />
                    <span className="text-sm text-slate-600">I agree</span>
                  </div>
                ) : q.type === "select" ? (
                  <select disabled className="w-full px-3 py-2 text-sm border rounded-md bg-white">
                    <option>Select...</option>
                    {q.options?.map((opt: string) => <option key={opt}>{opt}</option>)}
                  </select>
                ) : q.type === "textarea" ? (
                  <textarea disabled className="w-full px-3 py-2 text-sm border rounded-md bg-white" rows={2} />
                ) : (
                  <input type="text" disabled className="w-full px-3 py-2 text-sm border rounded-md bg-white" />
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onClose()}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Empty state
function EmptyFormsState({ onCreateClick, onTemplateClick }: { onCreateClick: () => void; onTemplateClick: (t: any) => void; }) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8">
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-100/40 to-teal-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 mb-4">
          <FileText className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Create Your First Form</h3>
        <p className="text-slate-600 max-w-md mx-auto">
          Collect waivers, vehicle info, and custom questions from guests.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {starterTemplates.map((t) => (
          <button
            key={t.name}
            onClick={() => onTemplateClick(t)}
            className="group p-4 rounded-lg border-2 border-slate-200 bg-white text-left transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
              {t.icon}
            </div>
            <div className="font-medium text-slate-900 mb-1">{t.name}</div>
            <div className="text-xs text-slate-500">{t.description}</div>
          </button>
        ))}
      </div>
      <div className="text-center">
        <Button variant="outline" onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Start from scratch
        </Button>
      </div>
    </div>
  );
}

// Convert questions to fields
function questionsToFields(questions: Question[]): { questions: any[] } {
  return {
    questions: questions.map(q => {
      const base: any = { label: q.label, type: q.type, required: q.required };
      if (q.type === "select" && q.options) base.options = q.options;
      return base;
    })
  };
}

// Convert fields to questions
function fieldsToQuestions(fields: any): Question[] {
  if (!fields?.questions) return [];
  return fields.questions.map((q: any) => ({
    id: generateId(),
    label: q.label || "",
    type: q.type || "text",
    required: q.required || false,
    options: q.options,
  }));
}

export default function FormsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormTemplateInput>(emptyForm);
  const [modalTab, setModalTab] = useState<"questions" | "settings">("questions");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationName, setCelebrationName] = useState("");
  const [previewForm, setPreviewForm] = useState<any>(null);
  const [isFirstForm, setIsFirstForm] = useState(false);

  useEffect(() => {
    const cg = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    setCampgroundId(cg);
  }, []);

  const templatesQuery = useQuery({
    queryKey: ["form-templates", campgroundId],
    queryFn: () => apiClient.getFormTemplates(campgroundId!),
    enabled: !!campgroundId,
  });

  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId!),
    enabled: !!campgroundId,
  });

  useEffect(() => {
    if (templatesQuery.data) {
      setIsFirstForm(templatesQuery.data.length === 0);
    }
  }, [templatesQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const fields = questionsToFields(form.questions);
      const payload = {
        title: form.title,
        type: form.type,
        description: form.description || undefined,
        fields,
        isActive: form.isActive,
        autoAttachMode: form.autoAttachMode,
        siteClassIds: form.siteClassIds,
        showAt: form.showAt,
        isRequired: form.isRequired,
        allowSkipWithNote: form.allowSkipWithNote,
        validityDays: form.validityDays ?? undefined,
        sendReminder: form.sendReminder,
        reminderDaysBefore: form.reminderDaysBefore ?? undefined,
      };

      if (editingId) {
        return apiClient.updateFormTemplate(editingId, payload);
      }
      return apiClient.createFormTemplate({ campgroundId: campgroundId!, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-templates", campgroundId] });
      setIsModalOpen(false);
      if (!editingId && isFirstForm) {
        setCelebrationName(form.title);
        setShowCelebration(true);
      } else {
        toast({ title: editingId ? "Form updated" : "Form created" });
      }
      setEditingId(null);
      setForm(emptyForm);
      setModalTab("questions");
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to save form", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteFormTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-templates", campgroundId] });
      toast({ title: "Form deleted" });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete form", variant: "destructive" });
      setDeleteConfirmId(null);
    },
  });

  const attachMutation = useMutation({
    mutationFn: ({ templateId, reservationId, guestId }: { templateId: string; reservationId?: string; guestId?: string }) => {
      return apiClient.createFormSubmission({
        formTemplateId: templateId,
        reservationId,
        guestId,
        responses: {}
      });
    },
    onSuccess: () => {
      toast({ title: "Form attached", description: "The form has been linked successfully." });
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to attach form", variant: "destructive" })
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalTab("questions");
    setIsModalOpen(true);
  };

  const openFromTemplate = (template: typeof starterTemplates[0]) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      title: template.name,
      type: template.type,
      description: template.description,
      questions: template.questions.map(q => ({ ...q, id: generateId() })),
      autoAttachMode: template.autoAttachMode,
      showAt: template.showAt,
    });
    setModalTab("questions");
    setIsModalOpen(true);
  };

  const openEdit = (id: string) => {
    const t = templatesQuery.data?.find((x: any) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setForm({
      title: t.title,
      type: t.type,
      description: t.description || "",
      questions: fieldsToQuestions(t.fields),
      isActive: t.isActive ?? true,
      autoAttachMode: t.autoAttachMode || "manual",
      siteClassIds: t.siteClassIds || [],
      showAt: t.showAt || ["during_booking"],
      isRequired: t.isRequired ?? true,
      allowSkipWithNote: t.allowSkipWithNote ?? false,
      validityDays: t.validityDays ?? null,
      sendReminder: t.sendReminder ?? false,
      reminderDaysBefore: t.reminderDaysBefore ?? 1,
    });
    setModalTab("questions");
    setIsModalOpen(true);
  };

  const formToDelete = templatesQuery.data?.find((t: any) => t.id === deleteConfirmId);
  const siteClasses = siteClassesQuery.data || [];

  // Helper to get auto-attach badge
  const getAutoAttachBadge = (t: any) => {
    if (t.autoAttachMode === "all_bookings") {
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">All bookings</Badge>;
    }
    if (t.autoAttachMode === "site_classes" && t.siteClassIds?.length > 0) {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{t.siteClassIds.length} site types</Badge>;
    }
    return <Badge variant="secondary">Manual</Badge>;
  };

  return (
    <DashboardShell>
      <FirstFormCelebration open={showCelebration} onClose={() => setShowCelebration(false)} formName={celebrationName} />
      <FormPreview open={!!previewForm} onClose={() => setPreviewForm(null)} form={previewForm} />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete Form Template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-slate-900">{formToDelete?.title}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <div role="status" aria-live="polite" className="sr-only">
          {templatesQuery.isLoading ? "Loading forms..." : `${templatesQuery.data?.length || 0} forms`}
        </div>

        {/* Forms List Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                  <FileText className="h-4 w-4" />
                </span>
                Forms & Waivers
              </CardTitle>
              <CardDescription>Create forms, configure auto-attach rules, and manage submissions.</CardDescription>
            </div>
            {campgroundId && !templatesQuery.isLoading && templatesQuery.data && templatesQuery.data.length > 0 && (
              <Button onClick={openCreate} className="bg-gradient-to-r from-emerald-500 to-teal-500">
                <Plus className="h-4 w-4 mr-2" />
                New form
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!campgroundId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5" />
                <span>Select a campground from the sidebar to manage forms.</span>
              </div>
            )}

            {templatesQuery.isLoading && (
              <div className="space-y-3">
                <FormCardSkeleton />
                <FormCardSkeleton />
              </div>
            )}

            {campgroundId && !templatesQuery.isLoading && templatesQuery.data?.length === 0 && (
              <EmptyFormsState onCreateClick={openCreate} onTemplateClick={openFromTemplate} />
            )}

            {templatesQuery.data && templatesQuery.data.length > 0 && (
              <div className="grid gap-3">
                {templatesQuery.data.map((t: any, index: number) => (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-lg border border-slate-200 bg-white p-4",
                      "transition-all duration-200 hover:shadow-md hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{t.title}</span>
                          <Badge variant="secondary" className="uppercase flex items-center gap-1">
                            {typeIcons[t.type]}
                            {t.type}
                          </Badge>
                          {getAutoAttachBadge(t)}
                          <Badge variant={t.isActive ? "default" : "secondary"} className={t.isActive ? "bg-emerald-100 text-emerald-700" : ""}>
                            {t.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {t.description && <div className="text-sm text-slate-600">{t.description}</div>}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{t.fields?.questions?.length || 0} questions</span>
                          <span>•</span>
                          <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewForm(t)} aria-label="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(t.id)}>
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(t.id)} className="text-slate-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Attach Card */}
        {templatesQuery.data && templatesQuery.data.length > 0 && campgroundId && (
          <Card>
            <CardContent className="pt-6">
              <ManualAttach
                templates={templatesQuery.data}
                campgroundId={campgroundId}
                onAttach={(templateId, reservationId, guestId) => {
                  attachMutation.mutate({ templateId, reservationId, guestId });
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              {editingId ? "Edit form" : "New form"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Update your form and settings" : "Create a form to collect guest information"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="questions" className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                Questions
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4">
              <TabsContent value="questions" className="mt-0 space-y-5">
                {!editingId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Start with a template</label>
                    <div className="flex flex-wrap gap-2">
                      {starterTemplates.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            title: t.name,
                            type: t.type,
                            description: t.description,
                            questions: t.questions.map(q => ({ ...q, id: generateId() })),
                            autoAttachMode: t.autoAttachMode,
                            showAt: t.showAt,
                          }))}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                            form.title === t.name ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300"
                          )}
                        >
                          {t.icon}
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Form name</label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Liability Waiver"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Category</label>
                    <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="waiver"><span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Waiver</span></SelectItem>
                        <SelectItem value="vehicle"><span className="flex items-center gap-2"><Car className="h-4 w-4" /> Vehicle</span></SelectItem>
                        <SelectItem value="intake"><span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Intake</span></SelectItem>
                        <SelectItem value="custom"><span className="flex items-center gap-2"><FileQuestion className="h-4 w-4" /> Custom</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description shown to guests"
                  />
                </div>

                <QuestionBuilder
                  questions={form.questions}
                  onChange={(questions) => setForm(f => ({ ...f, questions }))}
                />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <FormSettings
                  form={form}
                  onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
                  siteClasses={siteClasses.map((sc: any) => ({ id: sc.id, name: sc.name }))}
                />
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm(f => ({ ...f, isActive: checked }))} id="form-active" />
              <label htmlFor="form-active" className="text-sm text-slate-700">Active</label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setIsModalOpen(false); setEditingId(null); }}>Cancel</Button>
              <Button
                onClick={() => upsertMutation.mutate()}
                disabled={upsertMutation.isPending || !form.title}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {editingId ? "Save changes" : "Create form"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
