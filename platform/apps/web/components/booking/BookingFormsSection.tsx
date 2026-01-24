"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { FileText, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

interface BookingFormsSectionProps {
  campgroundId: string;
  siteClassId?: string | null;
  guestInfo: {
    adults: number;
    children: number;
    petCount: number;
    equipment?: {
      type: string;
    };
  };
  stayLength: number;
  onFormsComplete: (
    complete: boolean,
    responses: Record<string, Record<string, string | boolean>>,
  ) => void;
}

interface FormQuestion {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface FormTemplate {
  id: string;
  title: string;
  type: string;
  description?: string;
  fields?: {
    questions?: FormQuestion[];
  };
  isRequired?: boolean;
  allowSkipWithNote?: boolean;
  displayConditions?: Array<{
    field: string;
    operator: string;
    value: string | number | string[];
  }>;
  conditionLogic?: "all" | "any";
  showAt?: string[];
}

// Evaluate if a form should be shown based on its display conditions
function shouldShowForm(
  template: FormTemplate,
  context: {
    pets: number;
    adults: number;
    children: number;
    rigType: string;
    siteClassId?: string;
    stayLength: number;
  },
): boolean {
  const conditions = template.displayConditions || [];
  if (conditions.length === 0) return true;

  const logic = template.conditionLogic || "all";

  const evaluateCondition = (cond: {
    field: string;
    operator: string;
    value: string | number | string[];
  }) => {
    let fieldValue: string | number | undefined;
    switch (cond.field) {
      case "pets":
        fieldValue = context.pets;
        break;
      case "adults":
        fieldValue = context.adults;
        break;
      case "children":
        fieldValue = context.children;
        break;
      case "rigType":
        fieldValue = context.rigType;
        break;
      case "siteClassId":
        fieldValue = context.siteClassId;
        break;
      case "stayLength":
        fieldValue = context.stayLength;
        break;
      default:
        return true;
    }

    switch (cond.operator) {
      case "equals":
        return fieldValue === cond.value;
      case "not_equals":
        return fieldValue !== cond.value;
      case "greater_than":
        return (
          typeof fieldValue === "number" &&
          typeof cond.value === "number" &&
          fieldValue > cond.value
        );
      case "less_than":
        return (
          typeof fieldValue === "number" &&
          typeof cond.value === "number" &&
          fieldValue < cond.value
        );
      case "in":
        return Array.isArray(cond.value) && cond.value.some((val) => val === fieldValue);
      case "not_in":
        return Array.isArray(cond.value) && !cond.value.some((val) => val === fieldValue);
      case "contains":
        return (
          typeof fieldValue === "string" &&
          typeof cond.value === "string" &&
          fieldValue.includes(cond.value)
        );
      default:
        return true;
    }
  };

  const results = conditions.map(evaluateCondition);
  return logic === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function BookingFormsSection({
  campgroundId,
  siteClassId,
  guestInfo,
  stayLength,
  onFormsComplete,
}: BookingFormsSectionProps) {
  const [formResponses, setFormResponses] = useState<
    Record<string, Record<string, string | boolean>>
  >({});
  const [completedForms, setCompletedForms] = useState<Set<string>>(new Set());
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [skipNotes, setSkipNotes] = useState<Record<string, string>>({});

  // Fetch form templates for this campground
  const templatesQuery = useQuery({
    queryKey: ["booking-form-templates", campgroundId],
    queryFn: async () => {
      const res = await fetch(`/api/public/campgrounds/${campgroundId}/forms`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!campgroundId,
  });

  const templates = templatesQuery.data || [];

  // Filter templates that should show during booking
  const bookingForms = useMemo(() => {
    const context = {
      pets: guestInfo.petCount || 0,
      adults: guestInfo.adults || 1,
      children: guestInfo.children || 0,
      rigType: guestInfo.equipment?.type || "",
      siteClassId: siteClassId || "",
      stayLength,
    };

    return templates.filter((t: FormTemplate) => {
      // Must have "during_booking" in showAt
      if (!t.showAt?.includes("during_booking")) return false;
      // Must pass display conditions
      return shouldShowForm(t, context);
    });
  }, [templates, guestInfo, siteClassId, stayLength]);

  // Calculate completion status
  const requiredForms = bookingForms.filter((f: FormTemplate) => f.isRequired !== false);
  const allRequiredComplete = requiredForms.every(
    (f: FormTemplate) => completedForms.has(f.id) || (f.allowSkipWithNote && skipNotes[f.id]),
  );

  // Notify parent of completion status
  useEffect(() => {
    onFormsComplete(allRequiredComplete, formResponses);
  }, [allRequiredComplete, formResponses, onFormsComplete]);

  if (templatesQuery.isLoading) {
    return null; // Don't show loading for forms - they're optional
  }

  if (bookingForms.length === 0) {
    return null; // No forms to show
  }

  const handleInputChange = (formId: string, questionId: string, value: string | boolean) => {
    setFormResponses((prev) => ({
      ...prev,
      [formId]: {
        ...(prev[formId] || {}),
        [questionId]: value,
      },
    }));
  };

  const handleCompleteForm = (formId: string) => {
    const template = bookingForms.find((f: FormTemplate) => f.id === formId);
    if (!template) return;

    const questions = template.fields?.questions || [];
    const responses = formResponses[formId] || {};

    // Check required questions
    const missingRequired = questions.filter((q: FormQuestion) => q.required && !responses[q.id]);
    if (missingRequired.length > 0) {
      alert(
        `Please complete all required fields: ${missingRequired.map((q: FormQuestion) => q.label).join(", ")}`,
      );
      return;
    }

    setCompletedForms((prev) => new Set([...prev, formId]));
    setExpandedForm(null);
  };

  const handleSkipForm = (formId: string) => {
    if (!skipNotes[formId]?.trim()) {
      alert("Please provide a reason for skipping this form.");
      return;
    }
    setCompletedForms((prev) => new Set([...prev, formId]));
    setExpandedForm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-foreground">Required Forms</h3>
        <Badge variant={allRequiredComplete ? "default" : "destructive"} className="ml-auto">
          {completedForms.size}/{bookingForms.length} Complete
        </Badge>
      </div>

      <div className="space-y-3">
        {bookingForms.map((template: FormTemplate) => {
          const isComplete = completedForms.has(template.id);
          const isExpanded = expandedForm === template.id;
          const questions = template.fields?.questions || [];

          return (
            <Card
              key={template.id}
              className={cn("transition-all", isComplete && "bg-emerald-50 border-emerald-200")}
            >
              <CardHeader
                className="cursor-pointer py-3"
                onClick={() => setExpandedForm(isExpanded ? null : template.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : template.isRequired !== false ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">{template.title}</CardTitle>
                    {template.isRequired === false && (
                      <Badge variant="outline" className="text-xs">
                        Optional
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                {template.description && !isExpanded && (
                  <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                )}
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  {template.description && (
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  )}

                  {questions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      This form has no questions. Click complete to acknowledge.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((q) => (
                        <div key={q.id} className="space-y-1.5">
                          <label className="text-sm font-medium text-foreground">
                            {q.label}
                            {q.required && <span className="text-red-500 ml-1">*</span>}
                          </label>

                          {q.type === "text" && (
                            <Input
                              value={String(formResponses[template.id]?.[q.id] ?? "")}
                              onChange={(e) => handleInputChange(template.id, q.id, e.target.value)}
                              placeholder="Enter your answer"
                            />
                          )}

                          {q.type === "textarea" && (
                            <Textarea
                              value={String(formResponses[template.id]?.[q.id] ?? "")}
                              onChange={(e) => handleInputChange(template.id, q.id, e.target.value)}
                              placeholder="Enter your answer"
                              rows={3}
                            />
                          )}

                          {q.type === "number" && (
                            <Input
                              type="number"
                              value={String(formResponses[template.id]?.[q.id] ?? "")}
                              onChange={(e) => handleInputChange(template.id, q.id, e.target.value)}
                              placeholder="Enter a number"
                            />
                          )}

                          {q.type === "checkbox" && (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={Boolean(formResponses[template.id]?.[q.id])}
                                onCheckedChange={(checked) =>
                                  handleInputChange(template.id, q.id, checked)
                                }
                              />
                              <span className="text-sm text-muted-foreground">I agree</span>
                            </div>
                          )}

                          {q.type === "select" && q.options && (
                            <Select
                              value={String(formResponses[template.id]?.[q.id] ?? "")}
                              onValueChange={(v) => handleInputChange(template.id, q.id, v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select an option" />
                              </SelectTrigger>
                              <SelectContent>
                                {q.options.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button size="sm" onClick={() => handleCompleteForm(template.id)}>
                      <Check className="h-4 w-4 mr-1" />
                      Complete
                    </Button>

                    {template.allowSkipWithNote && template.isRequired !== false && (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          placeholder="Reason for skipping..."
                          value={skipNotes[template.id] || ""}
                          onChange={(e) =>
                            setSkipNotes((prev) => ({ ...prev, [template.id]: e.target.value }))
                          }
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSkipForm(template.id)}
                          disabled={!skipNotes[template.id]?.trim()}
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {!allRequiredComplete && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Please complete all required forms before proceeding to payment.</span>
        </div>
      )}
    </div>
  );
}
