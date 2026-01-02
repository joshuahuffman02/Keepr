"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Check, AlertCircle, ChevronDown, ChevronUp, Loader2, CheckCircle } from "lucide-react";

interface FormTemplate {
  id: string;
  title: string;
  type: string;
  description?: string;
  fields?: {
    questions?: Array<{
      id: string;
      label: string;
      type: string;
      required: boolean;
      options?: string[];
    }>;
  };
  isRequired?: boolean;
  allowSkipWithNote?: boolean;
}

export default function GuestFormsPage() {
  const params = useParams();
  const reservationId = params.reservationId as string;
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [formResponses, setFormResponses] = useState<Record<string, Record<string, any>>>({});
  const [completedForms, setCompletedForms] = useState<Set<string>>(new Set());
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [skipNotes, setSkipNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch reservation details
  const { data: reservation, isLoading: loadingRes } = useQuery({
    queryKey: ["guest-reservation", reservationId, token],
    queryFn: async () => {
      const res = await fetch(`/api/public/reservations/${reservationId}?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("Reservation not found");
      return res.json();
    },
    enabled: !!reservationId && !!token
  });

  // Fetch forms for this reservation's campground
  const { data: forms = [], isLoading: loadingForms } = useQuery({
    queryKey: ["guest-forms", reservation?.campgroundId],
    queryFn: async () => {
      const res = await fetch(`/api/public/campgrounds/${reservation.campgroundId}/forms?showAt=after_booking`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!reservation?.campgroundId
  });

  // Fetch already submitted forms for this reservation
  const { data: submissions = [] } = useQuery({
    queryKey: ["guest-form-submissions", reservationId, token],
    queryFn: async () => {
      const res = await fetch(`/api/public/reservations/${reservationId}/form-submissions?token=${encodeURIComponent(token)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!reservationId && !!token
  });

  // Mark already-submitted forms as complete
  useEffect(() => {
    if (submissions.length > 0) {
      const submittedIds = new Set<string>(submissions.map((s: any) => s.formTemplateId));
      setCompletedForms(submittedIds);
    }
  }, [submissions]);

  // Submit form mutation
  const submitMutation = useMutation({
    mutationFn: async ({ formTemplateId, responses }: { formTemplateId: string; responses: Record<string, any> }) => {
      const res = await fetch("/api/public/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId,
          campgroundId: reservation?.campgroundId,
          reservationId,
          responses
        })
      });
      if (!res.ok) throw new Error("Failed to submit form");
      return res.json();
    },
    onSuccess: (_, variables) => {
      setCompletedForms(prev => new Set([...prev, variables.formTemplateId]));
      setExpandedForm(null);
      setError(null);
    },
    onError: () => {
      setError("Failed to submit form. Please try again.");
    }
  });

  // Early return for missing token (after all hooks)
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Token Required</h1>
          <p className="text-slate-600">Please use the link provided in your email to access your forms.</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (formId: string, questionId: string, value: any) => {
    setFormResponses(prev => ({
      ...prev,
      [formId]: {
        ...(prev[formId] || {}),
        [questionId]: value
      }
    }));
  };

  const handleCompleteForm = (form: FormTemplate) => {
    const questions = form.fields?.questions || [];
    const responses = formResponses[form.id] || {};

    // Check required questions
    const missingRequired = questions.filter(q => q.required && !responses[q.id]);
    if (missingRequired.length > 0) {
      setError(`Please complete required fields: ${missingRequired.map(q => q.label).join(", ")}`);
      return;
    }

    submitMutation.mutate({ formTemplateId: form.id, responses });
  };

  const handleSkipForm = (formId: string) => {
    if (!skipNotes[formId]?.trim()) {
      setError("Please provide a reason for skipping this form.");
      return;
    }
    // Submit with skip note
    submitMutation.mutate({
      formTemplateId: formId,
      responses: { _skipped: true, _skipReason: skipNotes[formId] }
    });
  };

  // Calculate completion
  const requiredForms = forms.filter((f: FormTemplate) => f.isRequired !== false);
  const allRequiredComplete = requiredForms.every((f: FormTemplate) =>
    completedForms.has(f.id)
  );

  if (loadingRes || loadingForms) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your forms...</p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Reservation Not Found</h2>
            <p className="text-slate-600">
              We couldn't find this reservation. Please check the link and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">All Set!</h2>
            <p className="text-slate-600">
              There are no additional forms required for your reservation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-emerald-600" />
            </div>
            <CardTitle>Complete Your Forms</CardTitle>
            <CardDescription>
              {reservation.campground?.name || "Your campground"} requires the following forms to be completed before your stay.
            </CardDescription>
            <div className="mt-4 text-sm text-slate-600">
              <p>Reservation: <strong>{reservation.site?.siteNumber}</strong></p>
              <p>Arriving: <strong>{new Date(reservation.arrivalDate).toLocaleDateString()}</strong></p>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Required Forms</h3>
            <Badge variant={allRequiredComplete ? "default" : "secondary"}>
              {completedForms.size}/{forms.length} Complete
            </Badge>
          </div>

          {forms.map((form: FormTemplate) => {
            const isComplete = completedForms.has(form.id);
            const isExpanded = expandedForm === form.id;
            const questions = form.fields?.questions || [];

            return (
              <Card key={form.id} className={isComplete ? "bg-emerald-50 border-emerald-200" : ""}>
                <div
                  className="p-4 cursor-pointer flex items-center justify-between"
                  onClick={() => !isComplete && setExpandedForm(isExpanded ? null : form.id)}
                >
                  <div className="flex items-center gap-3">
                    {isComplete ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : form.isRequired !== false ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <FileText className="h-5 w-5 text-slate-400" />
                    )}
                    <div>
                      <h4 className="font-medium text-slate-900">{form.title}</h4>
                      {form.description && !isExpanded && (
                        <p className="text-sm text-slate-500 mt-0.5">{form.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {form.isRequired === false && <Badge variant="outline">Optional</Badge>}
                    {isComplete ? (
                      <Badge variant="default" className="bg-emerald-600">Completed</Badge>
                    ) : (
                      isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && !isComplete && (
                  <CardContent className="pt-0 space-y-4 border-t border-slate-100">
                    {form.description && (
                      <p className="text-sm text-slate-600">{form.description}</p>
                    )}

                    {questions.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        This form has no questions. Click complete to acknowledge.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {questions.map((q) => (
                          <div key={q.id} className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                              {q.label}
                              {q.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {q.type === "text" && (
                              <Input
                                value={formResponses[form.id]?.[q.id] || ""}
                                onChange={(e) => handleInputChange(form.id, q.id, e.target.value)}
                                placeholder="Enter your answer"
                              />
                            )}

                            {q.type === "textarea" && (
                              <Textarea
                                value={formResponses[form.id]?.[q.id] || ""}
                                onChange={(e) => handleInputChange(form.id, q.id, e.target.value)}
                                placeholder="Enter your answer"
                                rows={3}
                              />
                            )}

                            {q.type === "number" && (
                              <Input
                                type="number"
                                value={formResponses[form.id]?.[q.id] || ""}
                                onChange={(e) => handleInputChange(form.id, q.id, e.target.value)}
                                placeholder="Enter a number"
                              />
                            )}

                            {q.type === "checkbox" && (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={formResponses[form.id]?.[q.id] || false}
                                  onCheckedChange={(checked) => handleInputChange(form.id, q.id, checked)}
                                />
                                <span className="text-sm text-slate-600">I agree</span>
                              </div>
                            )}

                            {q.type === "select" && q.options && (
                              <Select
                                value={formResponses[form.id]?.[q.id] || ""}
                                onValueChange={(v) => handleInputChange(form.id, q.id, v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                                <SelectContent>
                                  {q.options.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {error && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        {error}
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <Button
                        onClick={() => handleCompleteForm(form)}
                        disabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Complete
                      </Button>

                      {form.allowSkipWithNote && form.isRequired !== false && (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            placeholder="Reason for skipping..."
                            value={skipNotes[form.id] || ""}
                            onChange={(e) => setSkipNotes(prev => ({ ...prev, [form.id]: e.target.value }))}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            onClick={() => handleSkipForm(form.id)}
                            disabled={!skipNotes[form.id]?.trim() || submitMutation.isPending}
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

        {allRequiredComplete && (
          <Card className="mt-6 bg-emerald-50 border-emerald-200">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-emerald-900 mb-2">All Forms Complete!</h2>
              <p className="text-emerald-700">
                Thank you for completing all required forms. We look forward to your stay!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
