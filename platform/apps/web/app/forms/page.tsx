"use client";

import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Checkbox } from "../../components/ui/checkbox";
import { apiClient } from "../../lib/api-client";
import { useToast } from "../../components/ui/use-toast";
import {
  FileText,
  Plus,
  Sparkles,
  Shield,
  Car,
  ClipboardList,
  FileQuestion,
  Eye,
  Trash2,
  Edit3,
  PartyPopper,
  CheckCircle2,
  AlertTriangle,
  PawPrint,
  Loader2,
  ChevronUp,
  Settings2,
  ChevronDown,
  Type,
  Hash,
  CheckSquare,
  List,
  AlignLeft,
  Phone,
  Mail,
  X,
  Calendar,
  Clock,
  Send,
  Users,
  Zap,
  Link2,
  Bell,
  RefreshCw,
  Search,
  ScrollText,
  Scale,
  FileSignature,
  PenLine,
} from "lucide-react";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import { ContractsTab } from "./ContractsTab";

type IconComponent = React.ComponentType<{ className?: string }>;

type QuestionType = "text" | "textarea" | "number" | "checkbox" | "select" | "phone" | "email";
type ConditionLogic = "all" | "any";
type ConditionFieldType = "number" | "select" | "siteClass" | "text";
type AutoAttachMode = "manual" | "all_bookings" | "site_classes";
type ShowAtOption = "during_booking" | "at_checkin" | "after_booking" | "on_demand";
type CollectionFormType = "waiver" | "vehicle" | "intake" | "custom";
type LegalFormType = "park_rules" | "liability_waiver" | "long_term_stay" | "legal_agreement";
type FormType = CollectionFormType | LegalFormType;

const questionTypeValues: QuestionType[] = [
  "text",
  "textarea",
  "number",
  "checkbox",
  "select",
  "phone",
  "email",
];

const formTypeValues: FormType[] = [
  "waiver",
  "vehicle",
  "intake",
  "custom",
  "park_rules",
  "liability_waiver",
  "long_term_stay",
  "legal_agreement",
];

const legalFormTypeValues: LegalFormType[] = [
  "park_rules",
  "liability_waiver",
  "long_term_stay",
  "legal_agreement",
];

const showAtValues: ShowAtOption[] = ["during_booking", "at_checkin", "after_booking", "on_demand"];

const conditionLogicValues: ConditionLogic[] = ["all", "any"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isQuestionType = (value: string): value is QuestionType =>
  questionTypeValues.some((type) => type === value);

const isFormType = (value: string): value is FormType =>
  formTypeValues.some((type) => type === value);

const isLegalDocumentType = (type: string): type is LegalFormType =>
  legalFormTypeValues.some((value) => value === type);

const isShowAtOption = (value: string): value is ShowAtOption =>
  showAtValues.some((option) => option === value);

const isConditionLogic = (value: string): value is ConditionLogic =>
  conditionLogicValues.some((logic) => logic === value);

// Question types with friendly labels
const questionTypes: Array<{
  value: QuestionType;
  label: string;
  icon: IconComponent;
  description: string;
}> = [
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
  type: QuestionType;
  required: boolean;
  options?: string[];
};

type DisplayCondition = {
  id: string;
  field: "pets" | "adults" | "children" | "rigType" | "siteClassId" | "addOns" | "stayLength";
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "in" | "not_in" | "contains";
  value: string | number | string[];
};

type EnforcementType = "none" | "pre_booking" | "pre_checkin" | "post_booking";

const enforcementTypeValues: EnforcementType[] = [
  "none",
  "pre_booking",
  "pre_checkin",
  "post_booking",
];

const isEnforcementType = (value: string): value is EnforcementType =>
  enforcementTypeValues.some((entry) => entry === value);

type FormTemplateInput = {
  title: string;
  type: FormType;
  description: string;
  questions: Question[];
  isActive: boolean;
  // Settings
  autoAttachMode: AutoAttachMode;
  siteClassIds: string[];
  showAt: ShowAtOption[];
  isRequired: boolean;
  allowSkipWithNote: boolean;
  validityDays: number | null;
  sendReminder: boolean;
  reminderDaysBefore: number | null;
  // Conditional display
  displayConditions: DisplayCondition[];
  conditionLogic: ConditionLogic;
  // Legal document fields (for Policies backend)
  documentContent?: string;
  requireSignature?: boolean;
  enforcement?: EnforcementType;
  // Track which backend this came from (for editing)
  _backend?: "form" | "policy";
  _originalId?: string;
};

type ModalTab = "questions" | "settings";

type CreateFormPayload = Omit<FormTemplateInput, "_backend" | "_originalId"> & {
  campgroundId?: string;
};

type UpdateFormPayload = Omit<FormTemplateInput, "_backend" | "_originalId">;

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
  displayConditions: [],
  conditionLogic: "all",
  // Legal document defaults
  documentContent: "",
  requireSignature: true,
  enforcement: "post_booking",
};

type ConditionFieldOption = {
  value: DisplayCondition["field"];
  label: string;
  type: ConditionFieldType;
  options?: string[];
};

type ConditionOperatorOption = {
  value: DisplayCondition["operator"];
  label: string;
};

const conditionFields: ConditionFieldOption[] = [
  { value: "pets", label: "Number of pets", type: "number" },
  { value: "adults", label: "Number of adults", type: "number" },
  { value: "children", label: "Number of children", type: "number" },
  { value: "stayLength", label: "Length of stay (nights)", type: "number" },
  {
    value: "rigType",
    label: "Rig type",
    type: "select",
    options: ["rv", "trailer", "tent", "car", "motorcycle", "other"],
  },
  { value: "siteClassId", label: "Site type", type: "siteClass" },
  { value: "addOns", label: "Selected add-ons", type: "text" },
];

const displayConditionOperatorValues: DisplayCondition["operator"][] = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "in",
  "not_in",
  "contains",
];

const isDisplayConditionField = (value: string): value is DisplayCondition["field"] =>
  conditionFields.some((field) => field.value === value);

const isDisplayConditionOperator = (value: string): value is DisplayCondition["operator"] =>
  displayConditionOperatorValues.some((op) => op === value);

const conditionOperators: Record<ConditionFieldType, ConditionOperatorOption[]> = {
  number: [
    { value: "greater_than", label: "is more than" },
    { value: "less_than", label: "is less than" },
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "does not equal" },
  ],
  select: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "in", label: "is one of" },
  ],
  siteClass: [
    { value: "equals", label: "is" },
    { value: "in", label: "is one of" },
  ],
  text: [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
  ],
};

// Generate unique ID for questions
const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Starter templates - organized by category
type StarterTemplate = {
  name: string;
  icon: React.ReactNode;
  type: FormType;
  description: string;
  questions: Question[];
  autoAttachMode: FormTemplateInput["autoAttachMode"];
  showAt: ShowAtOption[];
  category: "collection" | "legal";
  // Legal document specific
  documentContent?: string;
  enforcement?: FormTemplateInput["enforcement"];
};

type PolicyTemplate = Awaited<ReturnType<typeof apiClient.getPolicyTemplates>>[number];
type FormTemplateApi = Awaited<ReturnType<typeof apiClient.getFormTemplates>>[number];
type ReservationRecord = Awaited<ReturnType<typeof apiClient.getReservations>>[number];
type GuestRecord = Awaited<ReturnType<typeof apiClient.getGuests>>[number];
type SiteClassRecord = Awaited<ReturnType<typeof apiClient.getSiteClasses>>[number];

type FormFieldQuestion = {
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

type FormFields = {
  questions: FormFieldQuestion[];
};

type TemplateListItem = {
  id: string;
  title: string;
  type: FormType;
  description?: string | null;
  fields: FormFields;
  isActive?: boolean;
  autoAttachMode?: AutoAttachMode;
  siteClassIds?: string[];
  showAt?: ShowAtOption[];
  isRequired?: boolean;
  allowSkipWithNote?: boolean;
  validityDays?: number | null;
  sendReminder?: boolean;
  reminderDaysBefore?: number | null;
  displayConditions?: DisplayCondition[];
  conditionLogic?: ConditionLogic;
  documentContent?: string;
  enforcement?: EnforcementType;
  requireSignature?: boolean;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  _backend: "form" | "policy";
};

type CreateFormTemplatePayload = Parameters<typeof apiClient.createFormTemplate>[0];
type UpdateFormTemplatePayload = Parameters<typeof apiClient.updateFormTemplate>[1];

type MainTab = "forms" | "contracts";

const mainTabValues: MainTab[] = ["forms", "contracts"];
const modalTabValues: ModalTab[] = ["questions", "settings"];

const isMainTab = (value: string): value is MainTab => mainTabValues.some((tab) => tab === value);

const isModalTab = (value: string): value is ModalTab =>
  modalTabValues.some((tab) => tab === value);

const starterTemplates: StarterTemplate[] = [
  // === Data Collection Templates ===
  {
    name: "Vehicle Registration",
    icon: <Car className="h-5 w-5" />,
    type: "vehicle",
    description: "Collect RV/vehicle details for registration",
    autoAttachMode: "site_classes",
    showAt: ["during_booking", "at_checkin"],
    category: "collection",
    questions: [
      {
        id: generateId(),
        label: "Vehicle type",
        type: "select",
        options: ["RV/Motorhome", "Travel Trailer", "Fifth Wheel", "Tent", "Car/Truck"],
        required: true,
      },
      { id: generateId(), label: "Vehicle length (feet)", type: "number", required: true },
      { id: generateId(), label: "License plate number", type: "text", required: true },
      { id: generateId(), label: "License plate state", type: "text", required: true },
    ],
  },
  {
    name: "Pet Information",
    icon: <PawPrint className="h-5 w-5" />,
    type: "intake",
    description: "Collect pet details and vaccination status",
    autoAttachMode: "manual",
    showAt: ["at_checkin"],
    category: "collection",
    questions: [
      {
        id: generateId(),
        label: "Pet type",
        type: "select",
        options: ["Dog", "Cat", "Other"],
        required: true,
      },
      { id: generateId(), label: "Pet breed", type: "text", required: true },
      { id: generateId(), label: "Pet name", type: "text", required: true },
      {
        id: generateId(),
        label: "Is your pet up to date on vaccinations?",
        type: "checkbox",
        required: true,
      },
    ],
  },
  {
    name: "Guest Intake",
    icon: <ClipboardList className="h-5 w-5" />,
    type: "intake",
    description: "Emergency contacts and special requests",
    autoAttachMode: "all_bookings",
    showAt: ["during_booking"],
    category: "collection",
    questions: [
      { id: generateId(), label: "Emergency contact name", type: "text", required: true },
      { id: generateId(), label: "Emergency contact phone", type: "phone", required: true },
      {
        id: generateId(),
        label: "Any medical conditions we should know about?",
        type: "textarea",
        required: false,
      },
      { id: generateId(), label: "Special requests or needs", type: "textarea", required: false },
    ],
  },
  {
    name: "Custom Form",
    icon: <FileQuestion className="h-5 w-5" />,
    type: "custom",
    description: "Start from scratch with your own questions",
    autoAttachMode: "manual",
    showAt: ["on_demand"],
    category: "collection",
    questions: [],
  },
  // === Legal Document Templates ===
  {
    name: "Park Rules Agreement",
    icon: <ScrollText className="h-5 w-5" />,
    type: "park_rules",
    description: "Campground rules and regulations acknowledgement",
    autoAttachMode: "all_bookings",
    showAt: ["during_booking"],
    category: "legal",
    enforcement: "post_booking",
    documentContent: `# Park Rules & Regulations

Welcome to our campground! Please read and acknowledge the following rules:

## Quiet Hours
- Quiet hours are from 10:00 PM to 8:00 AM
- Please be respectful of your neighbors at all times

## Pets
- All pets must be on a leash no longer than 6 feet
- Clean up after your pet immediately
- Pets may not be left unattended at your site

## Campfires
- Fires are only permitted in designated fire rings
- Never leave fires unattended
- Campfires must be fully extinguished before leaving or sleeping

## Speed Limit
- The speed limit throughout the campground is 5 MPH
- Watch for children and pets

## Check-out
- Check-out time is 11:00 AM
- Please leave your site clean and free of trash`,
    questions: [
      {
        id: generateId(),
        label: "I have read and agree to follow the park rules and regulations",
        type: "checkbox",
        required: true,
      },
    ],
  },
  {
    name: "Liability Waiver",
    icon: <Scale className="h-5 w-5" />,
    type: "liability_waiver",
    description: "Release of liability and assumption of risk",
    autoAttachMode: "all_bookings",
    showAt: ["during_booking"],
    category: "legal",
    enforcement: "pre_booking",
    documentContent: `# Release of Liability and Assumption of Risk

By signing this waiver, I acknowledge and agree to the following:

## Assumption of Risk
I understand that camping and outdoor activities involve inherent risks including, but not limited to: uneven terrain, wildlife encounters, weather conditions, fire hazards, and water-related activities.

## Release of Liability
I hereby release, waive, and discharge the campground, its owners, operators, employees, and agents from any and all liability, claims, demands, or causes of action that I may have arising out of or related to any loss, damage, or injury that may be sustained during my stay.

## Medical Authorization
In the event of an emergency, I authorize the campground staff to seek emergency medical treatment on my behalf.

## Insurance
I understand that the campground does not provide insurance coverage for guests and I am responsible for my own insurance.`,
    questions: [
      {
        id: generateId(),
        label: "I have read and understand this waiver",
        type: "checkbox",
        required: true,
      },
      {
        id: generateId(),
        label: "I voluntarily agree to assume all risks and release the campground from liability",
        type: "checkbox",
        required: true,
      },
      { id: generateId(), label: "Emergency contact name", type: "text", required: true },
      { id: generateId(), label: "Emergency contact phone", type: "phone", required: true },
    ],
  },
  {
    name: "Long-Term Stay Agreement",
    icon: <FileSignature className="h-5 w-5" />,
    type: "long_term_stay",
    description: "Extended stay terms and conditions",
    autoAttachMode: "manual",
    showAt: ["after_booking"],
    category: "legal",
    enforcement: "pre_checkin",
    documentContent: `# Long-Term Stay Agreement

This agreement outlines the terms and conditions for extended stays (30+ days).

## Payment Terms
- Rent is due on the 1st of each month
- A late fee of $25 will be applied after the 5th of the month
- Security deposit equal to one month's rent is required

## Site Maintenance
- Guest is responsible for maintaining the cleanliness of their site
- Grass must be kept trimmed if applicable
- No permanent structures may be erected without written permission

## Utilities
- Electric usage is metered and billed monthly
- Water and sewer are included in the site fee

## Termination
- Either party may terminate this agreement with 30 days written notice
- Immediate termination may occur for violation of park rules`,
    questions: [
      {
        id: generateId(),
        label: "I agree to the payment terms outlined above",
        type: "checkbox",
        required: true,
      },
      {
        id: generateId(),
        label: "I agree to maintain my site according to park standards",
        type: "checkbox",
        required: true,
      },
      {
        id: generateId(),
        label: "I understand the termination policy",
        type: "checkbox",
        required: true,
      },
    ],
  },
  {
    name: "Custom Legal Document",
    icon: <FileText className="h-5 w-5" />,
    type: "legal_agreement",
    description: "Create your own legal agreement",
    autoAttachMode: "manual",
    showAt: ["on_demand"],
    category: "legal",
    enforcement: "post_booking",
    documentContent: "",
    questions: [],
  },
];

// Form type icons and config
const typeConfig: Record<
  string,
  { icon: React.ReactNode; label: string; category: "collection" | "legal" }
> = {
  // Data collection
  waiver: { icon: <Shield className="h-4 w-4" />, label: "Waiver", category: "collection" },
  vehicle: { icon: <Car className="h-4 w-4" />, label: "Vehicle", category: "collection" },
  intake: { icon: <ClipboardList className="h-4 w-4" />, label: "Intake", category: "collection" },
  custom: { icon: <FileQuestion className="h-4 w-4" />, label: "Custom", category: "collection" },
  // Legal documents
  park_rules: { icon: <ScrollText className="h-4 w-4" />, label: "Park Rules", category: "legal" },
  liability_waiver: { icon: <Scale className="h-4 w-4" />, label: "Liability", category: "legal" },
  long_term_stay: {
    icon: <FileSignature className="h-4 w-4" />,
    label: "Long-Term",
    category: "legal",
  },
  legal_agreement: { icon: <FileText className="h-4 w-4" />, label: "Legal", category: "legal" },
};

// Legacy typeIcons for backwards compatibility
const typeIcons: Record<string, React.ReactNode> = Object.fromEntries(
  Object.entries(typeConfig).map(([k, v]) => [k, v.icon]),
);

const parseShowAtOptions = (value: unknown): ShowAtOption[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ShowAtOption => typeof item === "string" && isShowAtOption(item),
  );
};

const parseDisplayConditionValue = (value: unknown): DisplayCondition["value"] | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (isStringArray(value)) return value;
  return null;
};

const parseDisplayConditions = (value: unknown): DisplayCondition[] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<DisplayCondition[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    const field =
      typeof item.field === "string" && isDisplayConditionField(item.field) ? item.field : null;
    const operator =
      typeof item.operator === "string" && isDisplayConditionOperator(item.operator)
        ? item.operator
        : null;
    const parsedValue = parseDisplayConditionValue(item.value);
    if (!field || !operator || parsedValue === null) return acc;
    acc.push({
      id: generateId(),
      field,
      operator,
      value: parsedValue,
    });
    return acc;
  }, []);
};

const parseQuestions = (value: unknown): Question[] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<Question[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    const label = typeof item.label === "string" ? item.label : "";
    const typeValue =
      typeof item.type === "string" && isQuestionType(item.type) ? item.type : "text";
    const required = typeof item.required === "boolean" ? item.required : false;
    const options = isStringArray(item.options) ? item.options : undefined;
    acc.push({
      id: generateId(),
      label,
      type: typeValue,
      required,
      ...(options ? { options } : {}),
    });
    return acc;
  }, []);
};

const toFormFields = (value: unknown): FormFields => {
  if (!isRecord(value)) return { questions: [] };
  const rawQuestions = value.questions;
  if (!Array.isArray(rawQuestions)) return { questions: [] };
  const questions = rawQuestions.reduce<FormFieldQuestion[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    const label = typeof item.label === "string" ? item.label : "";
    const typeValue = typeof item.type === "string" ? item.type : "text";
    const required = typeof item.required === "boolean" ? item.required : false;
    const options = isStringArray(item.options) ? item.options : undefined;
    acc.push({
      label,
      type: typeValue,
      required,
      ...(options ? { options } : {}),
    });
    return acc;
  }, []);
  return { questions };
};

// ==== DUAL-BACKEND MAPPING FUNCTIONS ====

// Map FormTemplateInput to Policy API payload
function mapFormToPolicy(form: FormTemplateInput, campgroundId: string) {
  return {
    name: form.title,
    description: form.description || null,
    content: form.documentContent || "",
    type: form.type,
    isActive: form.isActive,
    autoSend: form.autoAttachMode === "all_bookings",
    siteClassId: form.siteClassIds?.[0] || null,
    policyConfig: {
      enforcement: form.enforcement || "post_booking",
      requireSignature: form.requireSignature ?? true,
      showAt: form.showAt,
      isRequired: form.isRequired,
      allowSkipWithNote: form.allowSkipWithNote,
      validityDays: form.validityDays,
      sendReminder: form.sendReminder,
      reminderDaysBefore: form.reminderDaysBefore,
      displayConditions: form.displayConditions,
      conditionLogic: form.conditionLogic,
      questions: form.questions, // Store questions in policyConfig for legal docs
    },
  };
}

// Map Policy API response to FormTemplateInput
function mapPolicyToForm(
  policy: PolicyTemplate,
): FormTemplateInput & { id: string; updatedAt?: string | Date; createdAt?: string | Date } {
  const config = isRecord(policy.policyConfig) ? policy.policyConfig : {};
  const showAt = parseShowAtOptions(config.showAt);
  const questions = parseQuestions(config.questions);
  const displayConditions = parseDisplayConditions(config.displayConditions);
  const conditionLogic =
    typeof config.conditionLogic === "string" && isConditionLogic(config.conditionLogic)
      ? config.conditionLogic
      : "all";
  const enforcement =
    typeof config.enforcement === "string" && isEnforcementType(config.enforcement)
      ? config.enforcement
      : "post_booking";
  const requireSignature =
    typeof config.requireSignature === "boolean" ? config.requireSignature : true;
  const isRequired = typeof config.isRequired === "boolean" ? config.isRequired : true;
  const allowSkipWithNote =
    typeof config.allowSkipWithNote === "boolean" ? config.allowSkipWithNote : false;
  const validityDays = typeof config.validityDays === "number" ? config.validityDays : null;
  const sendReminder = typeof config.sendReminder === "boolean" ? config.sendReminder : false;
  const reminderDaysBefore =
    typeof config.reminderDaysBefore === "number" ? config.reminderDaysBefore : 1;
  const resolvedType = isFormType(policy.type) ? policy.type : "legal_agreement";

  return {
    id: policy.id,
    title: policy.name,
    type: resolvedType,
    description: policy.description || "",
    documentContent: policy.content || "",
    questions,
    isActive: policy.isActive ?? true,
    autoAttachMode: policy.autoSend
      ? "all_bookings"
      : policy.siteClassId
        ? "site_classes"
        : "manual",
    siteClassIds: policy.siteClassId ? [policy.siteClassId] : [],
    showAt: showAt.length > 0 ? showAt : ["during_booking"],
    isRequired,
    allowSkipWithNote,
    validityDays,
    sendReminder,
    reminderDaysBefore,
    displayConditions,
    conditionLogic,
    enforcement,
    requireSignature,
    _backend: "policy",
    _originalId: policy.id,
    updatedAt: policy.updatedAt,
    createdAt: policy.createdAt,
  };
}

// Show At options
const showAtOptions: Array<{
  value: ShowAtOption;
  label: string;
  icon: IconComponent;
  description: string;
}> = [
  {
    value: "during_booking",
    label: "During online booking",
    icon: Calendar,
    description: "Guest fills out before payment",
  },
  {
    value: "at_checkin",
    label: "At check-in",
    icon: Clock,
    description: "Staff collects during check-in",
  },
  {
    value: "after_booking",
    label: "After booking (email)",
    icon: Send,
    description: "Sent via email after confirmation",
  },
  {
    value: "on_demand",
    label: "On demand only",
    icon: Users,
    description: "Only when manually requested",
  },
];

// Visual Question Builder Component
function QuestionBuilder({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}) {
  const addQuestion = () => {
    onChange([...questions, { id: generateId(), label: "", type: "text", required: false }]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
  };

  const moveQuestion = (id: string, direction: "up" | "down") => {
    const index = questions.findIndex((q) => q.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[swapIndex]] = [newQuestions[swapIndex], newQuestions[index]];
    onChange(newQuestions);
  };

  const addOption = (questionId: string) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q) return;
    updateQuestion(questionId, { options: [...(q.options || []), ""] });
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q || !q.options) return;
    const newOptions = [...q.options];
    newOptions[optionIndex] = value;
    updateQuestion(questionId, { options: newOptions });
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q || !q.options) return;
    updateQuestion(questionId, { options: q.options.filter((_, i) => i !== optionIndex) });
  };

  const getTypeIcon = (type: string) => {
    const t = questionTypes.find((qt) => qt.value === type);
    return t ? <t.icon className="h-4 w-4" /> : <Type className="h-4 w-4" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Questions</label>
        <span className="text-xs text-muted-foreground">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-muted p-6 text-center">
          <FileQuestion className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No questions yet</p>
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
                "rounded-lg border border-border bg-card p-3",
                "transition-all duration-200 hover:border-border",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(q.id, "up")}
                    disabled={index === 0}
                    className={cn(
                      "p-0.5 rounded hover:bg-muted transition-colors",
                      index === 0 && "opacity-30 cursor-not-allowed",
                    )}
                    aria-label="Move question up"
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(q.id, "down")}
                    disabled={index === questions.length - 1}
                    className={cn(
                      "p-0.5 rounded hover:bg-muted transition-colors",
                      index === questions.length - 1 && "opacity-30 cursor-not-allowed",
                    )}
                    aria-label="Move question down"
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                      onValueChange={(value) => {
                        if (!isQuestionType(value)) return;
                        updateQuestion(q.id, {
                          type: value,
                          options: value === "select" ? ["Option 1"] : undefined,
                        });
                      }}
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
                              <type.icon className="h-4 w-4 text-muted-foreground" />
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {q.type === "select" && (
                    <div className="pl-4 border-l-2 border-border space-y-1.5">
                      <div className="text-xs text-muted-foreground font-medium">
                        Dropdown options:
                      </div>
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground w-4">{optIdx + 1}.</span>
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                            placeholder={`Option ${optIdx + 1}`}
                            className="h-8 text-sm flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(q.id, optIdx)}
                            className="p-1 rounded hover:bg-status-error/15 text-muted-foreground hover:text-status-error transition-colors"
                            aria-label="Remove option"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="text-xs text-status-success hover:text-status-success/90 font-medium flex items-center gap-1"
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
                      <label htmlFor={`required-${q.id}`} className="text-xs text-muted-foreground">
                        Required
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="p-1.5 rounded hover:bg-status-error/15 text-muted-foreground hover:text-status-error transition-colors"
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
  siteClasses,
  siteClassesLoading = false,
  siteClassesError = null,
}: {
  form: FormTemplateInput;
  onChange: (updates: Partial<FormTemplateInput>) => void;
  siteClasses: { id: string; name: string }[];
  siteClassesLoading?: boolean;
  siteClassesError?: Error | null;
}) {
  return (
    <div className="space-y-6">
      {/* Auto-Attach Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <label className="text-sm font-medium text-foreground">Auto-attach to bookings</label>
        </div>
        <div className="grid gap-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted transition-colors">
            <input
              type="radio"
              name="autoAttachMode"
              checked={form.autoAttachMode === "manual"}
              onChange={() => onChange({ autoAttachMode: "manual", siteClassIds: [] })}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm text-foreground">Manual only</div>
              <div className="text-xs text-muted-foreground">
                Only attach when you manually select it
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted transition-colors">
            <input
              type="radio"
              name="autoAttachMode"
              checked={form.autoAttachMode === "all_bookings"}
              onChange={() => onChange({ autoAttachMode: "all_bookings", siteClassIds: [] })}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm text-foreground">All bookings</div>
              <div className="text-xs text-muted-foreground">
                Automatically attach to every booking
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted transition-colors">
            <input
              type="radio"
              name="autoAttachMode"
              checked={form.autoAttachMode === "site_classes"}
              onChange={() => onChange({ autoAttachMode: "site_classes" })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-foreground">Specific site types</div>
              <div className="text-xs text-muted-foreground">
                Only for selected accommodation types
              </div>
            </div>
          </label>
        </div>

        {/* Site Class Selection */}
        {form.autoAttachMode === "site_classes" && (
          <div className="ml-6 p-3 rounded-lg border border-border bg-muted space-y-2">
            <div className="text-xs font-medium text-foreground">Select site types:</div>
            {siteClassesLoading ? (
              <div className="text-xs text-muted-foreground">Loading site classes...</div>
            ) : siteClassesError ? (
              <div className="text-xs text-status-error">
                Error loading site classes: {String(siteClassesError)}
              </div>
            ) : siteClasses.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No site types found. Create site classes first.
              </div>
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
                          onChange({
                            siteClassIds: form.siteClassIds.filter((id) => id !== sc.id),
                          });
                        }
                      }}
                    />
                    <span className="text-sm text-foreground">{sc.name}</span>
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
          <label className="text-sm font-medium text-foreground">When to show this form</label>
        </div>
        <div className="grid gap-2">
          {showAtOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted transition-colors"
            >
              <Checkbox
                checked={form.showAt.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange({ showAt: [...form.showAt, option.value] });
                  } else {
                    onChange({ showAt: form.showAt.filter((v) => v !== option.value) });
                  }
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <option.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">{option.label}</span>
                </div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Required Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <label className="text-sm font-medium text-foreground">Completion requirements</label>
        </div>
        <div className="space-y-3 p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Required to complete</div>
              <div className="text-xs text-muted-foreground">Guest must fill out this form</div>
            </div>
            <Switch
              checked={form.isRequired}
              onCheckedChange={(checked) => onChange({ isRequired: checked })}
            />
          </div>
          {form.isRequired && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <div className="text-sm font-medium text-foreground">Allow skip with note</div>
                <div className="text-xs text-muted-foreground">
                  Guest can skip but must provide reason
                </div>
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
          <label className="text-sm font-medium text-foreground">Form validity</label>
        </div>
        <div className="space-y-3 p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Expires after</div>
              <div className="text-xs text-muted-foreground">Require re-signing after period</div>
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
          <label className="text-sm font-medium text-foreground">Reminders</label>
        </div>
        <div className="space-y-3 p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Send email reminder</div>
              <div className="text-xs text-muted-foreground">
                Remind guests to complete before arrival
              </div>
            </div>
            <Switch
              checked={form.sendReminder}
              onCheckedChange={(checked) => onChange({ sendReminder: checked })}
            />
          </div>
          {form.sendReminder && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-sm text-foreground">Days before check-in</div>
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

      {/* Conditional Display Rules */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-indigo-500" />
          <label className="text-sm font-medium text-foreground">Conditional display</label>
        </div>
        <div className="text-xs text-muted-foreground -mt-1">
          Only show this form when certain conditions are met
        </div>

        <div className="space-y-3 p-3 rounded-lg border border-border">
          {form.displayConditions.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground mb-2">
                No conditions set - form shows for all bookings
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newCondition: DisplayCondition = {
                    id: generateId(),
                    field: "pets",
                    operator: "greater_than",
                    value: 0,
                  };
                  onChange({ displayConditions: [...form.displayConditions, newCondition] });
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add condition
              </Button>
            </div>
          ) : (
            <>
              {/* Condition Logic Toggle */}
              {form.displayConditions.length > 1 && (
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <span className="text-xs text-muted-foreground">Show when</span>
                  <Select
                    value={form.conditionLogic}
                    onValueChange={(value) => {
                      if (isConditionLogic(value)) {
                        onChange({ conditionLogic: value });
                      }
                    }}
                  >
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ALL match</SelectItem>
                      <SelectItem value="any">ANY match</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Condition List */}
              <div className="space-y-2">
                {form.displayConditions.map((condition, index) => {
                  const fieldConfig = conditionFields.find((f) => f.value === condition.field);
                  const operatorType: ConditionFieldType = fieldConfig?.type ?? "text";
                  const operators = conditionOperators[operatorType] ?? conditionOperators.text;

                  return (
                    <div
                      key={condition.id}
                      className="flex items-center gap-2 p-2 rounded bg-muted"
                    >
                      {/* Field Select */}
                      <Select
                        value={condition.field}
                        onValueChange={(value) => {
                          if (!isDisplayConditionField(value)) return;
                          const updated = [...form.displayConditions];
                          const newField = conditionFields.find((field) => field.value === value);
                          const nextFieldType = newField?.type ?? "text";
                          updated[index] = {
                            ...condition,
                            field: value,
                            operator: nextFieldType === "number" ? "greater_than" : "equals",
                            value: nextFieldType === "number" ? 0 : "",
                          };
                          onChange({ displayConditions: updated });
                        }}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {conditionFields.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Operator Select */}
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => {
                          if (!isDisplayConditionOperator(value)) return;
                          const updated = [...form.displayConditions];
                          updated[index] = { ...condition, operator: value };
                          onChange({ displayConditions: updated });
                        }}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op: { value: string; label: string }) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Value Input */}
                      {fieldConfig?.type === "number" && (
                        <Input
                          type="number"
                          value={typeof condition.value === "number" ? condition.value : 0}
                          onChange={(e) => {
                            const updated = [...form.displayConditions];
                            updated[index] = { ...condition, value: parseInt(e.target.value) || 0 };
                            onChange({ displayConditions: updated });
                          }}
                          className="w-[70px] h-8 text-xs"
                        />
                      )}
                      {fieldConfig?.type === "select" && (
                        <Select
                          value={typeof condition.value === "string" ? condition.value : ""}
                          onValueChange={(v) => {
                            const updated = [...form.displayConditions];
                            updated[index] = { ...condition, value: v };
                            onChange({ displayConditions: updated });
                          }}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldConfig.options?.map((opt) => (
                              <SelectItem key={opt} value={opt} className="capitalize">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {fieldConfig?.type === "siteClass" && (
                        <Select
                          value={typeof condition.value === "string" ? condition.value : ""}
                          onValueChange={(v) => {
                            const updated = [...form.displayConditions];
                            updated[index] = { ...condition, value: v };
                            onChange({ displayConditions: updated });
                          }}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {siteClasses.map((sc) => (
                              <SelectItem key={sc.id} value={sc.id}>
                                {sc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {fieldConfig?.type === "text" && (
                        <Input
                          type="text"
                          value={typeof condition.value === "string" ? condition.value : ""}
                          onChange={(e) => {
                            const updated = [...form.displayConditions];
                            updated[index] = { ...condition, value: e.target.value };
                            onChange({ displayConditions: updated });
                          }}
                          placeholder="Value..."
                          className="w-[100px] h-8 text-xs"
                        />
                      )}

                      {/* Remove Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-status-error"
                        onClick={() => {
                          onChange({
                            displayConditions: form.displayConditions.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Add Another Condition */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  const newCondition: DisplayCondition = {
                    id: generateId(),
                    field: "pets",
                    operator: "greater_than",
                    value: 0,
                  };
                  onChange({ displayConditions: [...form.displayConditions, newCondition] });
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add another condition
              </Button>
            </>
          )}
        </div>

        {/* Preset Conditions */}
        {form.displayConditions.length === 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                onChange({
                  displayConditions: [
                    {
                      id: generateId(),
                      field: "pets",
                      operator: "greater_than",
                      value: 0,
                    },
                  ],
                });
              }}
            >
              <PawPrint className="h-3 w-3 mr-1" />
              When pets added
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                onChange({
                  displayConditions: [
                    {
                      id: generateId(),
                      field: "rigType",
                      operator: "equals",
                      value: "rv",
                    },
                  ],
                });
              }}
            >
              <Car className="h-3 w-3 mr-1" />
              For RVs only
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                onChange({
                  displayConditions: [
                    {
                      id: generateId(),
                      field: "stayLength",
                      operator: "greater_than",
                      value: 7,
                    },
                  ],
                });
              }}
            >
              <Clock className="h-3 w-3 mr-1" />
              Long stays (7+ nights)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Manual Attach Component
function ManualAttach({
  templates,
  campgroundId,
  onAttach,
}: {
  templates: TemplateListItem[];
  campgroundId: string;
  onAttach: (templateId: string, reservationId?: string, guestId?: string) => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [searchType, setSearchType] = useState<"reservation" | "guest">("reservation");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  // Fetch reservations for search
  const reservationsQuery = useQuery<ReservationRecord[]>({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId && searchType === "reservation",
  });

  // Fetch guests for search
  const guestsQuery = useQuery<GuestRecord[]>({
    queryKey: ["guests", campgroundId],
    queryFn: () => apiClient.getGuests(campgroundId),
    enabled: !!campgroundId && searchType === "guest",
  });

  const reservationResults = (reservationsQuery.data || [])
    .filter(
      (r) =>
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.guest?.primaryFirstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.guest?.primaryLastName?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .slice(0, 10);

  const guestResults = (guestsQuery.data || [])
    .filter(
      (g) =>
        g.primaryFirstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.primaryLastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.email?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .slice(0, 10);

  const filteredResults = searchType === "reservation" ? reservationResults : guestResults;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Attach form manually</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Select Form */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Select form</label>
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
          <label className="text-sm font-medium text-foreground">Attach to</label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={searchType === "reservation" ? "default" : "outline"}
              onClick={() => {
                setSearchType("reservation");
                setSearchQuery("");
                setSelectedId("");
              }}
              className="flex-1"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Reservation
            </Button>
            <Button
              type="button"
              size="sm"
              variant={searchType === "guest" ? "default" : "outline"}
              onClick={() => {
                setSearchType("guest");
                setSearchQuery("");
                setSelectedId("");
              }}
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
        <label className="text-sm font-medium text-foreground">
          {searchType === "reservation" ? "Search reservations" : "Search guests"}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchType === "reservation"
                ? "Search by confirmation # or guest name..."
                : "Search by name or email..."
            }
            className="pl-10"
          />
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {filteredResults.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">No results found</div>
            ) : searchType === "reservation" ? (
              reservationResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-muted transition-colors",
                    selectedId === item.id && "bg-status-success/15",
                  )}
                >
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      #{item.id} - {item.guest?.primaryFirstName} {item.guest?.primaryLastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.arrivalDate).toLocaleDateString()} -{" "}
                      {new Date(item.departureDate).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              guestResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-muted transition-colors",
                    selectedId === item.id && "bg-status-success/15",
                  )}
                >
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      {item.primaryFirstName} {item.primaryLastName}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.email}</div>
                  </div>
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
              searchType === "guest" ? selectedId : undefined,
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
    <div className="rounded-lg border border-border bg-card p-4">
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
function FirstFormCelebration({
  open,
  onClose,
  formName,
}: {
  open: boolean;
  onClose: () => void;
  formName: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl p-8 text-center motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in duration-300 max-w-md mx-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-success text-white mb-4 motion-safe:animate-bounce">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Your First Form is Ready!</h3>
        <p className="text-muted-foreground mb-6">
          <span className="font-medium text-status-success">{formName}</span> is now available.
        </p>
        <Button onClick={onClose} className="bg-status-success hover:bg-status-success/90">
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
  form,
}: {
  open: boolean;
  onClose: () => void;
  form: TemplateListItem | null;
}) {
  if (!form) return null;
  const questions = fieldsToQuestions(form.fields);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Preview: {form.title}
          </DialogTitle>
        </DialogHeader>
        <div className="border rounded-lg p-4 bg-muted space-y-4">
          <div className="text-center pb-3 border-b">
            <h3 className="font-semibold">{form.title}</h3>
            {form.description && (
              <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
            )}
          </div>
          {questions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No questions</div>
          ) : (
            questions.map((q, idx) => (
              <div key={idx} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {q.label}
                  {q.required && <span className="text-status-error ml-1">*</span>}
                </label>
                {q.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" disabled className="h-4 w-4" />
                    <span className="text-sm text-muted-foreground">I agree</span>
                  </div>
                ) : q.type === "select" ? (
                  <select disabled className="w-full px-3 py-2 text-sm border rounded-md bg-card">
                    <option>Select...</option>
                    {q.options?.map((opt: string) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                ) : q.type === "textarea" ? (
                  <textarea
                    disabled
                    className="w-full px-3 py-2 text-sm border rounded-md bg-card"
                    rows={2}
                  />
                ) : (
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 text-sm border rounded-md bg-card"
                  />
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onClose()}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Empty state
function EmptyFormsState({
  onCreateClick,
  onTemplateClick,
}: {
  onCreateClick: () => void;
  onTemplateClick: (t: StarterTemplate) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted p-8">
      <div className="absolute top-0 right-0 w-48 h-48 bg-status-success/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-success/15 text-status-success mb-4">
          <FileText className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Create Your First Form</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Collect waivers, vehicle info, and custom questions from guests.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {starterTemplates.map((t) => (
          <button
            key={t.name}
            onClick={() => onTemplateClick(t)}
            className="group p-4 rounded-lg border-2 border-border bg-card text-left transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 bg-muted text-muted-foreground group-hover:bg-status-success/15 group-hover:text-status-success transition-colors">
              {t.icon}
            </div>
            <div className="font-medium text-foreground mb-1">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.description}</div>
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
function questionsToFields(questions: Question[]): FormFields {
  return {
    questions: questions.map((q) => {
      const base: FormFieldQuestion = { label: q.label, type: q.type, required: q.required };
      if (q.type === "select" && q.options) {
        return { ...base, options: q.options };
      }
      return base;
    }),
  };
}

// Convert fields to questions
function fieldsToQuestions(fields: FormFields | null | undefined): Question[] {
  if (!fields) return [];
  return fields.questions.map((q) => ({
    id: generateId(),
    label: q.label || "",
    type: isQuestionType(q.type) ? q.type : "text",
    required: q.required ?? false,
    ...(q.options ? { options: q.options } : {}),
  }));
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

export default function FormsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormTemplateInput>(emptyForm);
  const [modalTab, setModalTab] = useState<ModalTab>("questions");
  const [mainTab, setMainTab] = useState<MainTab>("forms");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationName, setCelebrationName] = useState("");
  const [previewForm, setPreviewForm] = useState<TemplateListItem | null>(null);
  const [isFirstForm, setIsFirstForm] = useState(false);

  useEffect(() => {
    const cg =
      typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    setCampgroundId(cg);
  }, []);

  // Query for form templates (data collection backend)
  const formTemplatesQuery = useQuery<FormTemplateApi[]>({
    queryKey: ["form-templates", campgroundId],
    queryFn: () => apiClient.getFormTemplates(campgroundId!),
    enabled: !!campgroundId,
  });

  // Query for policy templates (legal documents backend)
  const policyTemplatesQuery = useQuery<PolicyTemplate[]>({
    queryKey: ["policy-templates", campgroundId],
    queryFn: () => apiClient.getPolicyTemplates(campgroundId!),
    enabled: !!campgroundId,
  });

  const siteClassesQuery = useQuery<SiteClassRecord[]>({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId!),
    enabled: !!campgroundId,
  });

  // Merge both form templates and policy templates into a unified list
  const allTemplates = useMemo(() => {
    const forms: TemplateListItem[] = (formTemplatesQuery.data || []).map((formTemplate) => ({
      id: formTemplate.id,
      title: formTemplate.title,
      type: formTemplate.type,
      description: formTemplate.description ?? "",
      fields: toFormFields(formTemplate.fields),
      isActive: formTemplate.isActive,
      autoAttachMode: formTemplate.autoAttachMode,
      siteClassIds: formTemplate.siteClassIds,
      showAt: formTemplate.showAt,
      isRequired: formTemplate.isRequired,
      allowSkipWithNote: formTemplate.allowSkipWithNote,
      validityDays: formTemplate.validityDays ?? null,
      sendReminder: formTemplate.sendReminder,
      reminderDaysBefore: formTemplate.reminderDaysBefore ?? null,
      displayConditions: (formTemplate.displayConditions ?? []).map((condition) => ({
        id: generateId(),
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
      })),
      conditionLogic: formTemplate.conditionLogic,
      updatedAt: formTemplate.updatedAt,
      createdAt: formTemplate.createdAt,
      _backend: "form",
    }));

    // Only include legal document types from policy templates
    const policies: TemplateListItem[] = (policyTemplatesQuery.data || [])
      .filter((policy) => isLegalDocumentType(policy.type))
      .map((policy) => {
        const mapped = mapPolicyToForm(policy);
        return {
          id: mapped.id,
          title: mapped.title,
          type: mapped.type,
          description: mapped.description,
          fields: questionsToFields(mapped.questions),
          isActive: mapped.isActive,
          autoAttachMode: mapped.autoAttachMode,
          siteClassIds: mapped.siteClassIds,
          showAt: mapped.showAt,
          isRequired: mapped.isRequired,
          allowSkipWithNote: mapped.allowSkipWithNote,
          validityDays: mapped.validityDays,
          sendReminder: mapped.sendReminder,
          reminderDaysBefore: mapped.reminderDaysBefore,
          displayConditions: mapped.displayConditions,
          conditionLogic: mapped.conditionLogic,
          documentContent: mapped.documentContent,
          enforcement: mapped.enforcement,
          requireSignature: mapped.requireSignature,
          updatedAt: mapped.updatedAt,
          createdAt: mapped.createdAt,
          _backend: "policy",
        };
      });

    return [...forms, ...policies].sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
    );
  }, [formTemplatesQuery.data, policyTemplatesQuery.data]);

  // Combined loading state
  const isLoading = formTemplatesQuery.isLoading || policyTemplatesQuery.isLoading;

  useEffect(() => {
    if (!isLoading) {
      setIsFirstForm(allTemplates.length === 0);
    }
  }, [isLoading, allTemplates.length]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      // Route to appropriate backend based on form type
      if (isLegalDocumentType(form.type)) {
        // Use Policy API for legal documents
        const policyPayload = mapFormToPolicy(form, campgroundId!);

        if (editingId) {
          // Check if we're editing a policy or converting a form to a policy
          const existingTemplate = allTemplates.find((t) => t.id === editingId);
          if (existingTemplate?._backend === "policy") {
            return apiClient.updatePolicyTemplate(editingId, policyPayload, campgroundId!);
          }
          // If converting from form to policy, create new policy and optionally delete old form
          // For now, just create a new policy (user can manually delete old form if needed)
          return apiClient.createPolicyTemplate(campgroundId!, policyPayload);
        }
        return apiClient.createPolicyTemplate(campgroundId!, policyPayload);
      } else {
        // Use Form API for data collection types
        const fields = questionsToFields(form.questions);
        const payload: Omit<CreateFormTemplatePayload, "campgroundId"> = {
          title: form.title,
          type: form.type,
          description: form.description ?? undefined,
          fields: fields ?? undefined,
          isActive: form.isActive,
          autoAttachMode: form.autoAttachMode,
          siteClassIds: form.siteClassIds,
          showAt: form.showAt,
          isRequired: form.isRequired,
          allowSkipWithNote: form.allowSkipWithNote,
          validityDays: form.validityDays ?? undefined,
          sendReminder: form.sendReminder,
          reminderDaysBefore: form.reminderDaysBefore ?? undefined,
          displayConditions: form.displayConditions.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          })),
          conditionLogic: form.conditionLogic,
        };

        if (editingId) {
          // Check if we're editing a form or converting a policy to a form
          const existingTemplate = allTemplates.find((t) => t.id === editingId);
          if (existingTemplate?._backend === "form") {
            return apiClient.updateFormTemplate(editingId, payload);
          }
          // If converting from policy to form, create new form
          const createPayload: CreateFormTemplatePayload = {
            campgroundId: campgroundId!,
            ...payload,
            title: form.title,
            type: form.type,
          };
          return apiClient.createFormTemplate(createPayload);
        }
        const createPayload: CreateFormTemplatePayload = {
          campgroundId: campgroundId!,
          ...payload,
          title: form.title,
          type: form.type,
        };
        return apiClient.createFormTemplate(createPayload);
      }
    },
    onSuccess: () => {
      // Invalidate both queries to refresh the merged list
      queryClient.invalidateQueries({ queryKey: ["form-templates", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["policy-templates", campgroundId] });
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
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error, "Failed to save form"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      // Find the template to determine which backend to use
      const template = allTemplates.find((t) => t.id === id);
      if (template?._backend === "policy") {
        return apiClient.deletePolicyTemplate(id, campgroundId!);
      }
      return apiClient.deleteFormTemplate(id);
    },
    onSuccess: () => {
      // Invalidate both queries to refresh the merged list
      queryClient.invalidateQueries({ queryKey: ["form-templates", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["policy-templates", campgroundId] });
      toast({ title: "Form deleted" });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete form", variant: "destructive" });
      setDeleteConfirmId(null);
    },
  });

  const attachMutation = useMutation({
    mutationFn: ({
      templateId,
      reservationId,
      guestId,
    }: {
      templateId: string;
      reservationId?: string;
      guestId?: string;
    }) => {
      return apiClient.createFormSubmission({
        formTemplateId: templateId,
        reservationId,
        guestId,
        responses: {},
      });
    },
    onSuccess: () => {
      toast({ title: "Form attached", description: "The form has been linked successfully." });
    },
    onError: (error: unknown) =>
      toast({ title: getErrorMessage(error, "Failed to attach form"), variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalTab("questions");
    setIsModalOpen(true);
  };

  const openFromTemplate = (template: StarterTemplate) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      title: template.name,
      type: template.type,
      description: template.description,
      questions: template.questions.map((q) => ({ ...q, id: generateId() })),
      autoAttachMode: template.autoAttachMode,
      showAt: template.showAt,
    });
    setModalTab("questions");
    setIsModalOpen(true);
  };

  const openEdit = (id: string) => {
    // Use merged allTemplates list to find the template
    const t = allTemplates.find((template) => template.id === id);
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
      displayConditions: (t.displayConditions || []).map((condition) => ({ ...condition })),
      conditionLogic: t.conditionLogic || "all",
      // Legal document fields
      documentContent: t.documentContent || "",
      enforcement: t.enforcement || "post_booking",
      requireSignature: t.requireSignature ?? true,
      _backend: t._backend,
      _originalId: t.id,
    });
    setModalTab("questions");
    setIsModalOpen(true);
  };

  const formToDelete = allTemplates.find((template) => template.id === deleteConfirmId);
  const siteClasses = siteClassesQuery.data || [];
  const siteClassesError = siteClassesQuery.error instanceof Error ? siteClassesQuery.error : null;

  // Helper to get auto-attach badge
  const getAutoAttachBadge = (template: TemplateListItem) => {
    if (template.autoAttachMode === "all_bookings") {
      return (
        <Badge className="bg-status-warning/15 text-status-warning border-status-warning/30 hover:bg-status-warning/15">
          All bookings
        </Badge>
      );
    }
    const siteClassIds = template.siteClassIds ?? [];
    if (template.autoAttachMode === "site_classes" && siteClassIds.length > 0) {
      return (
        <Badge className="bg-status-info/15 text-status-info border-status-info/30 hover:bg-status-info/15">
          {siteClassIds.length} site types
        </Badge>
      );
    }
    return <Badge variant="secondary">Manual</Badge>;
  };

  return (
    <DashboardShell>
      <FirstFormCelebration
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        formName={celebrationName}
      />
      <FormPreview open={!!previewForm} onClose={() => setPreviewForm(null)} form={previewForm} />

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete Form Template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{formToDelete?.title}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-status-error text-white hover:bg-status-error/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Page Tabs */}
      <Tabs
        value={mainTab}
        onValueChange={(value) => {
          if (isMainTab(value)) {
            setMainTab(value);
          }
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="forms" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Forms & Waivers
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Contracts
          </TabsTrigger>
        </TabsList>

        {/* Forms Tab Content */}
        <TabsContent value="forms" className="space-y-6">
          <div role="status" aria-live="polite" className="sr-only">
            {isLoading ? "Loading forms..." : `${allTemplates.length} forms`}
          </div>

          {/* Forms List Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-status-success/15 text-status-success">
                    <FileText className="h-4 w-4" />
                  </span>
                  Forms & Documents
                </CardTitle>
                <CardDescription>
                  Create forms, legal documents, and configure auto-attach rules.
                </CardDescription>
              </div>
              {campgroundId && !isLoading && allTemplates.length > 0 && (
                <Button
                  onClick={openCreate}
                  className="bg-status-success hover:bg-status-success/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New form
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!campgroundId && (
                <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 p-4 text-sm text-status-warning flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Select a campground from the sidebar to manage forms.</span>
                </div>
              )}

              {isLoading && (
                <div className="space-y-3">
                  <FormCardSkeleton />
                  <FormCardSkeleton />
                </div>
              )}

              {campgroundId && !isLoading && allTemplates.length === 0 && (
                <EmptyFormsState onCreateClick={openCreate} onTemplateClick={openFromTemplate} />
              )}

              {allTemplates.length > 0 && (
                <div className="grid gap-3">
                  {allTemplates.map((t) => {
                    const updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "rounded-lg border border-border bg-card p-4",
                          "transition-all duration-200 hover:shadow-md hover:border-border",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">
                                {t.title}
                              </span>
                              <Badge
                                variant="secondary"
                                className="uppercase flex items-center gap-1"
                              >
                                {typeIcons[t.type] || <FileText className="h-4 w-4" />}
                                {typeConfig[t.type]?.label || t.type}
                              </Badge>
                              {/* Show category badge for legal documents */}
                              {isLegalDocumentType(t.type) && (
                                <Badge className="bg-status-info/15 text-status-info border-status-info/30 hover:bg-status-info/15">
                                  Legal
                                </Badge>
                              )}
                              {getAutoAttachBadge(t)}
                              <Badge
                                variant={t.isActive ? "default" : "secondary"}
                                className={
                                  t.isActive
                                    ? "bg-status-success/15 text-status-success border-status-success/30"
                                    : ""
                                }
                              >
                                {t.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            {t.description && (
                              <div className="text-sm text-muted-foreground">{t.description}</div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{t.fields?.questions?.length || 0} questions</span>
                              {isLegalDocumentType(t.type) && t.documentContent && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {t.documentContent.length > 100 ? "Has document content" : ""}
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span>
                                Updated {updatedAt ? updatedAt.toLocaleDateString() : "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPreviewForm(t)}
                              aria-label="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEdit(t.id)}>
                              <Edit3 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmId(t.id)}
                              className="text-muted-foreground hover:text-status-error hover:bg-status-error/15"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Attach Card */}
          {allTemplates.length > 0 && campgroundId && (
            <Card>
              <CardContent className="pt-6">
                <ManualAttach
                  templates={allTemplates}
                  campgroundId={campgroundId}
                  onAttach={(templateId, reservationId, guestId) => {
                    attachMutation.mutate({ templateId, reservationId, guestId });
                  }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contracts Tab Content */}
        <TabsContent value="contracts">
          <ContractsTab campgroundId={campgroundId} />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              {editingId ? "Edit form" : "New form"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update your form and settings"
                : "Create a form to collect guest information"}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={modalTab}
            onValueChange={(value) => {
              if (isModalTab(value)) {
                setModalTab(value);
              }
            }}
            className="flex-1 flex flex-col overflow-hidden"
          >
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
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Start with a template
                    </label>
                    {/* Data Collection Templates */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Data Collection
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {starterTemplates
                          .filter((t) => t.category === "collection")
                          .map((t) => (
                            <button
                              key={t.name}
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  title: t.name,
                                  type: t.type,
                                  description: t.description,
                                  questions: t.questions.map((q) => ({ ...q, id: generateId() })),
                                  autoAttachMode: t.autoAttachMode,
                                  showAt: t.showAt,
                                  documentContent: "",
                                  enforcement: "post_booking",
                                }))
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                                form.title === t.name
                                  ? "border-status-success/30 bg-status-success/15 text-status-success"
                                  : "border-border bg-muted text-muted-foreground hover:border-status-success/30",
                              )}
                            >
                              {t.icon}
                              {t.name}
                            </button>
                          ))}
                      </div>
                    </div>
                    {/* Legal Document Templates */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Legal Documents
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {starterTemplates
                          .filter((t) => t.category === "legal")
                          .map((t) => (
                            <button
                              key={t.name}
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  title: t.name,
                                  type: t.type,
                                  description: t.description,
                                  questions: t.questions.map((q) => ({ ...q, id: generateId() })),
                                  autoAttachMode: t.autoAttachMode,
                                  showAt: t.showAt,
                                  documentContent: t.documentContent || "",
                                  enforcement: t.enforcement || "post_booking",
                                  requireSignature: true,
                                }))
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                                form.title === t.name
                                  ? "border-blue-400 bg-blue-50 text-blue-700"
                                  : "border-border bg-muted text-muted-foreground hover:border-blue-300",
                              )}
                            >
                              {t.icon}
                              {t.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {isLegalDocumentType(form.type) ? "Document name" : "Form name"}
                    </label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={
                        isLegalDocumentType(form.type)
                          ? "e.g. Park Rules Agreement"
                          : "e.g. Vehicle Registration"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Type</label>
                    <Select
                      value={form.type}
                      onValueChange={(value) => {
                        if (isFormType(value)) {
                          setForm((current) => ({ ...current, type: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Data Collection
                        </div>
                        <SelectItem value="vehicle">
                          <span className="flex items-center gap-2">
                            <Car className="h-4 w-4" /> Vehicle Info
                          </span>
                        </SelectItem>
                        <SelectItem value="intake">
                          <span className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" /> Guest Intake
                          </span>
                        </SelectItem>
                        <SelectItem value="custom">
                          <span className="flex items-center gap-2">
                            <FileQuestion className="h-4 w-4" /> Custom Form
                          </span>
                        </SelectItem>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                          Legal Documents
                        </div>
                        <SelectItem value="park_rules">
                          <span className="flex items-center gap-2">
                            <ScrollText className="h-4 w-4" /> Park Rules
                          </span>
                        </SelectItem>
                        <SelectItem value="liability_waiver">
                          <span className="flex items-center gap-2">
                            <Scale className="h-4 w-4" /> Liability Waiver
                          </span>
                        </SelectItem>
                        <SelectItem value="long_term_stay">
                          <span className="flex items-center gap-2">
                            <FileSignature className="h-4 w-4" /> Long-Term Stay
                          </span>
                        </SelectItem>
                        <SelectItem value="legal_agreement">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Custom Legal
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Description{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description shown to guests"
                  />
                </div>

                {/* Document Content - shown for legal document types */}
                {isLegalDocumentType(form.type) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">
                        Document Content
                      </label>
                      <span className="text-xs text-muted-foreground">
                        Supports Markdown formatting
                      </span>
                    </div>
                    <Textarea
                      value={form.documentContent || ""}
                      onChange={(e) => setForm((f) => ({ ...f, documentContent: e.target.value }))}
                      placeholder="Enter the full text of your legal document here. Use Markdown for formatting (# for headings, - for lists, etc.)"
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      This text will be displayed to guests before they sign. You can add
                      acknowledgement questions below.
                    </p>
                  </div>
                )}

                {/* Enforcement setting for legal documents */}
                {isLegalDocumentType(form.type) && (
                  <div className="p-3 rounded-lg border border-status-info/30 bg-status-info/15 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-status-info">
                      <Scale className="h-4 w-4" />
                      Signature Requirements
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-status-info">
                          When is signature required?
                        </label>
                        <Select
                          value={form.enforcement || "post_booking"}
                          onValueChange={(v: EnforcementType) =>
                            setForm((f) => ({ ...f, enforcement: v }))
                          }
                        >
                          <SelectTrigger className="bg-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pre_booking">
                              Before booking (blocks checkout)
                            </SelectItem>
                            <SelectItem value="post_booking">
                              After booking (sent via email)
                            </SelectItem>
                            <SelectItem value="pre_checkin">Before check-in</SelectItem>
                            <SelectItem value="none">Informational only (no signature)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={form.requireSignature ?? true}
                          onCheckedChange={(checked) =>
                            setForm((f) => ({ ...f, requireSignature: checked }))
                          }
                          id="require-signature"
                        />
                        <label htmlFor="require-signature" className="text-xs text-status-info">
                          Require signature (vs. acknowledgement only)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <QuestionBuilder
                  questions={form.questions}
                  onChange={(questions) => setForm((f) => ({ ...f, questions }))}
                />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <FormSettings
                  form={form}
                  onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
                  siteClasses={siteClasses.map((sc) => ({ id: sc.id, name: sc.name }))}
                  siteClassesLoading={siteClassesQuery.isLoading}
                  siteClassesError={siteClassesError}
                />
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                id="form-active"
              />
              <label htmlFor="form-active" className="text-sm text-foreground">
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => upsertMutation.mutate()}
                disabled={upsertMutation.isPending || !form.title}
                className="bg-status-success text-white hover:bg-status-success/90"
              >
                {upsertMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {editingId ? "Save changes" : "Create form"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
