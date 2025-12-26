"use client";

import { useEffect, useMemo, useState } from "react";
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
import { apiClient } from "../../lib/api-client";
import { useToast } from "../../components/ui/use-toast";
import {
  FileText, Plus, Sparkles, Shield, Car, ClipboardList,
  FileQuestion, Eye, Trash2, Edit3, PartyPopper, CheckCircle2,
  AlertTriangle, PawPrint, Loader2, GripVertical, ChevronUp,
  ChevronDown, Type, Hash, CheckSquare, List, AlignLeft, Phone, Mail, X
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
};

const emptyForm: FormTemplateInput = {
  title: "",
  type: "waiver",
  description: "",
  questions: [],
  isActive: true,
};

// Generate unique ID for questions
const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Starter templates for quick creation
const starterTemplates: {
  name: string;
  icon: React.ReactNode;
  type: FormTemplateInput["type"];
  description: string;
  questions: Question[];
}[] = [
  {
    name: "Liability Waiver",
    icon: <Shield className="h-5 w-5" />,
    type: "waiver",
    description: "Standard liability and assumption of risk waiver",
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
                {/* Reorder buttons */}
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

                {/* Question content */}
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

                  {/* Options for dropdown type */}
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

                  {/* Required toggle */}
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

                {/* Delete button */}
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

// Loading skeleton for form cards
function FormCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

// Celebration modal for first form
function FirstFormCelebration({
  open,
  onClose,
  formName
}: {
  open: boolean;
  onClose: () => void;
  formName: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in duration-300 max-w-md mx-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white mb-4 motion-safe:animate-bounce">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Your First Form is Ready!
        </h3>
        <p className="text-slate-600 mb-6">
          <span className="font-medium text-emerald-600">{formName}</span> is now available.
          Guests can fill it out during booking or check-in.
        </p>

        <div className="bg-emerald-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div className="text-sm text-emerald-700">
              <p className="font-medium mb-1">What's next?</p>
              <ul className="space-y-1 text-emerald-600">
                <li>• Attach forms to reservations</li>
                <li>• View submissions in guest profiles</li>
                <li>• Create more forms as needed</li>
              </ul>
            </div>
          </div>
        </div>

        <Button onClick={onClose} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
          Got it!
        </Button>
      </div>
    </div>
  );
}

// Form preview modal
function FormPreview({
  open,
  onClose,
  form
}: {
  open: boolean;
  onClose: () => void;
  form: { title: string; type: string; description?: string; fields?: { questions?: any[] } } | null;
}) {
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
          <DialogDescription>
            This is how guests will see your form
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
          <div className="text-center pb-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">{form.title}</h3>
            {form.description && (
              <p className="text-sm text-slate-600 mt-1">{form.description}</p>
            )}
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              <FileQuestion className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              No questions defined yet
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    {q.label}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {q.type === "checkbox" ? (
                    <div className="flex items-center gap-2">
                      <input type="checkbox" disabled className="h-4 w-4 rounded" />
                      <span className="text-sm text-slate-600">I agree</span>
                    </div>
                  ) : q.type === "textarea" ? (
                    <textarea
                      disabled
                      placeholder="Guest response..."
                      className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                      rows={2}
                    />
                  ) : q.type === "select" ? (
                    <select disabled className="w-full px-3 py-2 text-sm border rounded-md bg-white">
                      <option>Select an option...</option>
                      {q.options?.map((opt: string) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={q.type || "text"}
                      disabled
                      placeholder="Guest response..."
                      className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200">
            <Button disabled className="w-full">Submit</Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onClose()}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Empty state component
function EmptyFormsState({ onCreateClick, onTemplateClick }: {
  onCreateClick: () => void;
  onTemplateClick: (template: typeof starterTemplates[0]) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-100/40 to-teal-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 mb-4">
          <FileText className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Create Your First Form
        </h3>
        <p className="text-slate-600 max-w-md mx-auto">
          Collect waivers, vehicle info, and custom questions from guests.
          Start with a template or build your own.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {starterTemplates.map((template) => (
          <button
            key={template.name}
            onClick={() => onTemplateClick(template)}
            className={cn(
              "group p-4 rounded-lg border-2 border-slate-200 bg-white text-left",
              "transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            )}
          >
            <div className={cn(
              "inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3",
              "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-600",
              "transition-colors duration-200"
            )}>
              {template.icon}
            </div>
            <div className="font-medium text-slate-900 mb-1">{template.name}</div>
            <div className="text-xs text-slate-500">{template.description}</div>
          </button>
        ))}
      </div>

      <div className="text-center">
        <Button
          variant="outline"
          onClick={onCreateClick}
          className="text-slate-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Start from scratch
        </Button>
      </div>
    </div>
  );
}

// Convert questions array to API format
function questionsToFields(questions: Question[]): { questions: any[] } {
  return {
    questions: questions.map(q => {
      const base: any = {
        label: q.label,
        type: q.type,
        required: q.required,
      };
      if (q.type === "select" && q.options) {
        base.options = q.options;
      }
      return base;
    })
  };
}

// Convert API fields to questions array
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
  const [attachReservationId, setAttachReservationId] = useState("");
  const [attachGuestId, setAttachGuestId] = useState("");
  const [attachTemplateId, setAttachTemplateId] = useState("");

  // New state for enhanced UX
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

  // Track if this will be the first form
  useEffect(() => {
    if (templatesQuery.data) {
      setIsFirstForm(templatesQuery.data.length === 0);
    }
  }, [templatesQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const fields = questionsToFields(form.questions);

      if (editingId) {
        return apiClient.updateFormTemplate(editingId, {
          title: form.title,
          type: form.type,
          description: form.description || null,
          fields,
          isActive: form.isActive,
        });
      }
      return apiClient.createFormTemplate({
        campgroundId: campgroundId!,
        title: form.title,
        type: form.type,
        description: form.description || undefined,
        fields,
        isActive: form.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-templates", campgroundId] });
      setIsModalOpen(false);

      // Show celebration for first form
      if (!editingId && isFirstForm) {
        setCelebrationName(form.title);
        setShowCelebration(true);
      } else {
        toast({
          title: editingId ? "Form updated" : "Form created",
          description: editingId ? "Your changes have been saved." : `${form.title} is now available.`
        });
      }

      setEditingId(null);
      setForm(emptyForm);
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
    mutationFn: () => {
      return apiClient.createFormSubmission({
        formTemplateId: attachTemplateId,
        reservationId: attachReservationId || undefined,
        guestId: attachGuestId || undefined,
        responses: {}
      });
    },
    onSuccess: () => {
      setAttachReservationId("");
      setAttachGuestId("");
      setAttachTemplateId("");
      toast({ title: "Form attached", description: "The form has been linked to the reservation/guest." });
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to attach form", variant: "destructive" })
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openFromTemplate = (template: typeof starterTemplates[0]) => {
    setEditingId(null);
    setForm({
      title: template.name,
      type: template.type,
      description: template.description,
      questions: template.questions.map(q => ({ ...q, id: generateId() })),
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEdit = (id: string) => {
    const t = templatesQuery.data?.find((x) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setForm({
      title: t.title,
      type: t.type as FormTemplateInput["type"],
      description: t.description || "",
      questions: fieldsToQuestions(t.fields),
      isActive: t.isActive ?? true,
    });
    setIsModalOpen(true);
  };

  const formToDelete = templatesQuery.data?.find(t => t.id === deleteConfirmId);

  return (
    <DashboardShell>
      {/* Celebration modal */}
      <FirstFormCelebration
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        formName={celebrationName}
      />

      {/* Form preview modal */}
      <FormPreview
        open={!!previewForm}
        onClose={() => setPreviewForm(null)}
        form={previewForm}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete Form Template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-slate-900">{formToDelete?.title}</span>?
              This action cannot be undone. Any existing submissions will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete form"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        {/* Live region for screen readers */}
        <div role="status" aria-live="polite" className="sr-only">
          {templatesQuery.isLoading
            ? "Loading forms..."
            : `${templatesQuery.data?.length || 0} forms loaded`}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                  <FileText className="h-4 w-4" />
                </span>
                Forms & Docs
              </CardTitle>
              <CardDescription>Waivers, vehicle/rig intake, and custom questions.</CardDescription>
            </div>
            {campgroundId && !templatesQuery.isLoading && templatesQuery.data && templatesQuery.data.length > 0 && (
              <Button onClick={openCreate} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                <Plus className="h-4 w-4 mr-2" />
                New form
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!campgroundId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <span>Select a campground from the sidebar to manage forms.</span>
              </div>
            )}

            {/* Loading state with skeletons */}
            {templatesQuery.isLoading && (
              <div className="space-y-3">
                <FormCardSkeleton />
                <FormCardSkeleton />
              </div>
            )}

            {/* Empty state */}
            {campgroundId && !templatesQuery.isLoading && templatesQuery.data?.length === 0 && (
              <EmptyFormsState
                onCreateClick={openCreate}
                onTemplateClick={openFromTemplate}
              />
            )}

            {/* Form list */}
            {templatesQuery.data && templatesQuery.data.length > 0 && (
              <div className="grid gap-3">
                {templatesQuery.data.map((t, index) => (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-lg border border-slate-200 bg-white p-4",
                      "transition-all duration-200 hover:shadow-md hover:border-slate-300",
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                    )}
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                          <Badge variant="secondary" className="uppercase flex items-center gap-1">
                            {typeIcons[t.type]}
                            {t.type}
                          </Badge>
                          <Badge
                            variant={t.isActive ? "default" : "secondary"}
                            className={t.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}
                          >
                            {t.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {t.fields?.questions?.length || 0} questions
                          </span>
                        </div>
                        {t.description && <div className="text-sm text-slate-600">{t.description}</div>}
                        <div className="text-xs text-slate-500">Updated {new Date(t.updatedAt).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewForm(t)}
                          aria-label={`Preview ${t.title}`}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(t.id)}
                          aria-label={`Edit ${t.title}`}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirmId(t.id)}
                          aria-label={`Delete ${t.title}`}
                          className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Attach form section */}
            {templatesQuery.data && templatesQuery.data.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-900">Attach a form to a reservation/guest</div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="attach-template" className="text-xs font-medium text-slate-600">Form template</label>
                    <Select value={attachTemplateId} onValueChange={setAttachTemplateId}>
                      <SelectTrigger id="attach-template">
                        <SelectValue placeholder="Select form" />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesQuery.data.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="attach-reservation" className="text-xs font-medium text-slate-600">Reservation ID</label>
                    <Input
                      id="attach-reservation"
                      placeholder="e.g. res_abc123"
                      value={attachReservationId}
                      onChange={(e) => setAttachReservationId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="attach-guest" className="text-xs font-medium text-slate-600">Guest ID</label>
                    <Input
                      id="attach-guest"
                      placeholder="e.g. guest_xyz789"
                      value={attachGuestId}
                      onChange={(e) => setAttachGuestId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => attachMutation.mutate()}
                    disabled={!attachTemplateId || attachMutation.isPending}
                  >
                    {attachMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Attaching...
                      </>
                    ) : (
                      "Attach form"
                    )}
                  </Button>
                </div>
                <div className="text-xs text-slate-500">
                  Provide a reservation or guest ID (or both) to create a submission placeholder. Responses can be collected later.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              {editingId ? "Edit form" : "New form"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Update your form template" : "Create a form to collect information from guests"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Quick template buttons when creating */}
            {!editingId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Start with a template</label>
                <div className="flex flex-wrap gap-2">
                  {starterTemplates.map((template) => (
                    <button
                      key={template.name}
                      type="button"
                      onClick={() => {
                        setForm({
                          title: template.name,
                          type: template.type,
                          description: template.description,
                          questions: template.questions.map(q => ({ ...q, id: generateId() })),
                          isActive: true,
                        });
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                        "border border-slate-200 bg-slate-50 text-slate-600",
                        "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
                        "transition-colors duration-150",
                        form.title === template.name && "border-emerald-400 bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {template.icon}
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="form-title" className="text-sm font-medium text-slate-900">Form name</label>
                <Input
                  id="form-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Liability Waiver"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="form-type" className="text-sm font-medium text-slate-900">Category</label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as FormTemplateInput["type"] }))}
                >
                  <SelectTrigger id="form-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiver">
                      <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Waiver</span>
                    </SelectItem>
                    <SelectItem value="vehicle">
                      <span className="flex items-center gap-2"><Car className="h-4 w-4" /> Vehicle / rig</span>
                    </SelectItem>
                    <SelectItem value="intake">
                      <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Intake</span>
                    </SelectItem>
                    <SelectItem value="custom">
                      <span className="flex items-center gap-2"><FileQuestion className="h-4 w-4" /> Custom</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="form-description" className="text-sm font-medium text-slate-900">Description <span className="text-slate-400 font-normal">(optional)</span></label>
              <Input
                id="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description shown to guests"
              />
            </div>

            {/* Visual Question Builder */}
            <QuestionBuilder
              questions={form.questions}
              onChange={(questions) => setForm((f) => ({ ...f, questions }))}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                  id="form-active"
                />
                <label htmlFor="form-active" className="text-sm text-slate-700">Active</label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setIsModalOpen(false); setEditingId(null); }}>Cancel</Button>
                <Button
                  onClick={() => upsertMutation.mutate()}
                  disabled={upsertMutation.isPending || !form.title}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {upsertMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {editingId ? "Save changes" : "Create form"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
