"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { apiClient } from "../../lib/api-client";

type Reservation = {
  id: string;
  guestId: string;
  guest?: { primaryFirstName?: string; primaryLastName?: string; email?: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  campgroundId: string;
  reservations: Reservation[];
  onComplete?: (results: { sent: number; failed: number }) => void;
};

export function BulkMessageModal({ open, onClose, campgroundId, reservations, onComplete }: Props) {
  const [messageType, setMessageType] = useState<"email" | "note">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });

  if (!open) return null;

  const recipientsWithEmail = reservations.filter((r) => r.guest?.email);
  const recipientsCount = messageType === "email" ? recipientsWithEmail.length : reservations.length;

  const handleSend = async () => {
    if (!body.trim()) return;

    const targets = messageType === "email" ? recipientsWithEmail : reservations;
    if (targets.length === 0) return;

    setSending(true);
    setProgress({ sent: 0, failed: 0, total: targets.length });

    let sent = 0;
    let failed = 0;

    for (const res of targets) {
      try {
        if (messageType === "email") {
          await apiClient.sendCommunication({
            campgroundId,
            reservationId: res.id,
            guestId: res.guestId,
            type: "email",
            direction: "outbound",
            subject: subject || "Message from your campground",
            body,
            toAddress: res.guest?.email
          });
        } else {
          await apiClient.createCommunication({
            campgroundId,
            reservationId: res.id,
            guestId: res.guestId,
            type: "note",
            direction: "outbound",
            subject: subject || undefined,
            body
          });
        }
        sent++;
      } catch {
        failed++;
      }
      setProgress({ sent, failed, total: targets.length });
    }

    setSending(false);
    onComplete?.({ sent, failed });

    if (failed === 0) {
      setSubject("");
      setBody("");
      onClose();
    }
  };

  const handleClose = () => {
    if (!sending) {
      setSubject("");
      setBody("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Message {reservations.length} guest{reservations.length !== 1 ? "s" : ""}
          </h2>
          <button
            className="text-muted-foreground hover:text-muted-foreground"
            onClick={handleClose}
            disabled={sending}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <div className="flex gap-2 rounded-lg bg-muted p-1">
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                messageType === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMessageType("email")}
              disabled={sending}
            >
              Send Email ({recipientsWithEmail.length})
            </button>
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                messageType === "note"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMessageType("note")}
              disabled={sending}
            >
              Add Note ({reservations.length})
            </button>
          </div>
        </div>

        {messageType === "email" && recipientsWithEmail.length < reservations.length && (
          <div className="mb-4 rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
            {reservations.length - recipientsWithEmail.length} guest{reservations.length - recipientsWithEmail.length !== 1 ? "s" : ""} without
            email address will be skipped.
          </div>
        )}

        {recipientsCount === 0 ? (
          <div className="mb-4 rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
            No valid recipients for {messageType === "email" ? "email" : "notes"}. Please check your selection.
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-foreground">
                {messageType === "email" ? "Subject" : "Title (optional)"}
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-action-primary focus:outline-none focus:ring-1 focus:ring-action-primary/40"
                placeholder={messageType === "email" ? "Subject line" : "Note title"}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-foreground">Message</label>
              <textarea
                className="h-32 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-action-primary focus:outline-none focus:ring-1 focus:ring-action-primary/40"
                placeholder={`Type your ${messageType === "email" ? "email" : "note"} here...`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={sending}
              />
            </div>

            {sending && (
              <div className="mb-4">
                <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                  <span>Sending...</span>
                  <span>
                    {progress.sent + progress.failed} / {progress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-action-primary transition-all"
                    style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }}
                  />
                </div>
                {progress.failed > 0 && (
                  <div className="mt-1 text-xs text-status-error">{progress.failed} failed</div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !body.trim() || recipientsCount === 0}>
                {sending
                  ? "Sending..."
                  : `Send to ${recipientsCount} guest${recipientsCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
