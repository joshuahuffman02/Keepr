"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { apiClient } from "../../lib/api-client";
import { format } from "date-fns";
import {
  FileText,
  Plus,
  Eye,
  Send,
  Check,
  X,
  MoreVertical,
  Clock,
  AlertCircle,
  CheckCircle2,
  SkipForward,
  ChevronDown,
} from "lucide-react";
import { useToast } from "../ui/use-toast";

interface ReservationFormsCardProps {
  campgroundId: string;
  reservationId: string;
}

type FormSubmission = Awaited<ReturnType<typeof apiClient.getFormSubmissionsByReservation>>[number];
type FormTemplate = Awaited<ReturnType<typeof apiClient.getFormTemplates>>[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getSkipNote = (responses: unknown): string | null => {
  if (!isRecord(responses)) return null;
  const note = responses._skipNote;
  return typeof note === "string" ? note : null;
};

function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy h:mma");
}

export function ReservationFormsCard({ campgroundId, reservationId }: ReservationFormsCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [skipNote, setSkipNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch form submissions for this reservation
  const submissionsQuery = useQuery<FormSubmission[]>({
    queryKey: ["form-submissions", reservationId],
    queryFn: () => apiClient.getFormSubmissionsByReservation(reservationId),
    enabled: !!reservationId,
  });

  // Fetch available form templates
  const templatesQuery = useQuery<FormTemplate[]>({
    queryKey: ["form-templates", campgroundId],
    queryFn: () => apiClient.getFormTemplates(campgroundId),
    enabled: !!campgroundId && attachModalOpen,
  });

  const submissions = submissionsQuery.data || [];
  const templates = templatesQuery.data || [];
  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const requiredPendingCount = submissions.filter(
    (s) => s.status === "pending" && s.formTemplate?.isRequired !== false,
  ).length;
  const responseEntries =
    selectedSubmission && isRecord(selectedSubmission.responses)
      ? Object.entries(selectedSubmission.responses).filter(([key]) => !key.startsWith("_"))
      : [];
  const skipNoteValue = getSkipNote(selectedSubmission?.responses);

  // Attach form mutation
  const attachMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiClient.createFormSubmission({
        formTemplateId: templateId,
        reservationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["form-submissions", reservationId],
      });
      setAttachModalOpen(false);
    },
  });

  // Update form submission mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      status?: "pending" | "completed" | "void";
      responses?: Record<string, unknown>;
    }) => apiClient.updateFormSubmission(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["form-submissions", reservationId],
      });
    },
  });

  // Delete form submission mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteFormSubmission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["form-submissions", reservationId],
      });
    },
  });

  // Filter already attached template IDs
  const attachedTemplateIds = new Set(submissions.map((s) => s.formTemplateId));
  const availableTemplates = templates.filter(
    (t) =>
      !attachedTemplateIds.has(t.id) &&
      t.isActive !== false &&
      t.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleMarkComplete = (submission: FormSubmission) => {
    updateMutation.mutate({ id: submission.id, status: "completed" });
  };

  const handleSkipWithNote = () => {
    if (!selectedSubmission) return;
    const baseResponses = isRecord(selectedSubmission.responses)
      ? selectedSubmission.responses
      : {};
    // Use void status with a skipNote in responses
    updateMutation.mutate({
      id: selectedSubmission.id,
      status: "void",
      responses: {
        ...baseResponses,
        _skipNote: skipNote,
        _skippedAt: new Date().toISOString(),
      },
    });
    setSkipModalOpen(false);
    setSkipNote("");
    setSelectedSubmission(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const getStatusBadge = (submission: FormSubmission) => {
    const status = submission.status;
    const isRequired = submission.formTemplate?.isRequired !== false;
    const isSkipped = status === "void" && Boolean(getSkipNote(submission.responses));

    if (status === "completed") {
      return (
        <Badge className="bg-status-success-bg text-status-success-text border-status-success-border">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    }
    if (isSkipped) {
      return (
        <Badge className="bg-muted text-muted-foreground border-border">
          <SkipForward className="h-3 w-3 mr-1" />
          Skipped
        </Badge>
      );
    }
    if (status === "void") {
      return <Badge className="bg-muted text-muted-foreground border-border">Voided</Badge>;
    }
    if (status === "pending" && isRequired) {
      return (
        <Badge className="bg-status-warning-bg text-status-warning-text border-status-warning-border">
          <AlertCircle className="h-3 w-3 mr-1" />
          Required
        </Badge>
      );
    }
    return (
      <Badge className="bg-status-info-bg text-status-info-text border-status-info-border">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getShowAtLabel = (showAt?: string[]) => {
    if (!showAt || showAt.length === 0) return null;
    const labels: Record<string, string> = {
      during_booking: "Booking",
      at_checkin: "Check-in",
      after_booking: "Email",
      on_demand: "On demand",
    };
    return showAt.map((s) => labels[s] || s).join(", ");
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-action-primary" />
            Forms & Documents
          </CardTitle>
          <div className="flex items-center gap-2">
            {submissionsQuery.isLoading ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : (
              <Badge variant={requiredPendingCount > 0 ? "destructive" : "secondary"}>
                {requiredPendingCount > 0
                  ? `${requiredPendingCount} required pending`
                  : pendingCount > 0
                    ? `${pendingCount} pending`
                    : "All complete"}
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={() => setAttachModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Attach
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {submissionsQuery.isError && (
            <div className="text-status-error text-xs">Failed to load forms.</div>
          )}

          {!submissionsQuery.isLoading && submissions.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm">No forms attached yet</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 text-action-primary hover:text-action-primary-hover"
                onClick={() => setAttachModalOpen(true)}
              >
                Attach a form
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">
                      {submission.formTemplate?.title || "Form"}
                    </span>
                    {getStatusBadge(submission)}
                    {!submission.formTemplate?.isRequired && (
                      <span className="text-[10px] text-muted-foreground uppercase">Optional</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="capitalize">{submission.formTemplate?.type || "custom"}</span>
                    {getShowAtLabel(submission.formTemplate?.showAt) && (
                      <>
                        <span>•</span>
                        <span>Show: {getShowAtLabel(submission.formTemplate?.showAt)}</span>
                      </>
                    )}
                    {submission.signedAt && (
                      <>
                        <span>•</span>
                        <span>Signed {formatDateTime(submission.signedAt)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {submission.status === "completed" &&
                    submission.responses &&
                    Object.keys(submission.responses).length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSubmission(submission);
                          setViewModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}

                  {submission.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkComplete(submission)}
                        title="Mark as complete"
                      >
                        <Check className="h-4 w-4 text-status-success" />
                      </Button>
                      {submission.formTemplate?.allowSkipWithNote && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setSkipModalOpen(true);
                          }}
                          title="Skip with note"
                        >
                          <SkipForward className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedSubmission(submission);
                          setViewModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View details
                      </DropdownMenuItem>
                      {submission.status === "pending" && (
                        <DropdownMenuItem
                          onClick={() =>
                            toast({
                              title: "Coming Soon",
                              description: "Reminder email functionality is under development.",
                            })
                          }
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send reminder
                        </DropdownMenuItem>
                      )}
                      {submission.status !== "completed" && (
                        <DropdownMenuItem onClick={() => handleMarkComplete(submission)}>
                          <Check className="h-4 w-4 mr-2" />
                          Mark complete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeleteConfirmId(submission.id)}
                        className="text-status-error"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Attach Form Modal */}
      <Dialog open={attachModalOpen} onOpenChange={setAttachModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach a Form</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {templatesQuery.isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Loading forms...</div>
            ) : availableTemplates.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {templates.length === 0
                  ? "No forms created yet. Create forms in Settings → Forms."
                  : searchQuery
                    ? "No matching forms found."
                    : "All forms already attached."}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {availableTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => attachMutation.mutate(template.id)}
                    disabled={attachMutation.isPending}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted hover:border-border transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{template.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="capitalize">{template.type}</span>
                          {template.isRequired !== false && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              Required
                            </Badge>
                          )}
                          {template.autoAttachMode !== "manual" && (
                            <Badge variant="outline" className="text-[10px] h-4 bg-status-info/10">
                              Auto-attach
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Responses Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedSubmission?.formTemplate?.title || "Form"} - Responses
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              {selectedSubmission && getStatusBadge(selectedSubmission)}
            </div>

            {selectedSubmission?.signedAt && (
              <div className="text-sm">
                <span className="text-muted-foreground">Signed at:</span>{" "}
                {formatDateTime(selectedSubmission.signedAt)}
              </div>
            )}

            {skipNoteValue && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Skip reason:</div>
                <div className="text-sm">{skipNoteValue}</div>
              </div>
            )}

            {responseEntries.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground uppercase">Responses</div>
                <div className="space-y-2">
                  {responseEntries.map(([key, value]) => (
                    <div key={key} className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">{key}</div>
                      <div className="text-sm">
                        {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {responseEntries.length === 0 && !skipNoteValue && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No responses recorded yet.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skip with Note Modal */}
      <Dialog open={skipModalOpen} onOpenChange={setSkipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Skip Form with Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Skipping "{selectedSubmission?.formTemplate?.title}". Please provide a reason for
              skipping this form.
            </p>

            <Textarea
              placeholder="Reason for skipping (e.g., Guest declined, Will complete later, N/A for this booking)"
              value={skipNote}
              onChange={(e) => setSkipNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSkipModalOpen(false);
                setSkipNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSkipWithNote}
              disabled={!skipNote.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Skip Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this form from the reservation? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
