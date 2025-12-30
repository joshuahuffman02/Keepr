"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useWhoami } from "@/hooks/use-whoami";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type TicketForm = {
  title: string;
  notes: string;
  category: "issue" | "question" | "feature" | "other";
  url?: string;
  path?: string;
  pageTitle?: string;
  userAgent?: string;
  selection?: string;
};

type TicketSubmitter = {
  id: string | null;
  name: string | null;
  email: string | null;
};

type DeviceType = "mobile" | "desktop" | "tablet";

type TicketClient = {
  userAgent: string;
  platform: string | null;
  language: string | null;
  deviceType: DeviceType;
};

type WhoamiUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
};

type WhoamiData = {
  user?: WhoamiUser;
  id?: string;
  email?: string;
  name?: string;
};

const LS_TICKET_DRAFT = "campreserv:ticket:draft";
const LS_TICKET_OPEN = "campreserv:ticket:open";

export function FloatingTicketWidget() {
  const { toast } = useToast();
  const { data: whoami } = useWhoami();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [form, setForm] = useState<TicketForm>({
    title: "",
    notes: "",
    category: "issue",
  });

  const selectionText = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (window.getSelection()?.toString() ?? "").slice(0, 500);
  }, [open]);

  // Restore draft on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LS_TICKET_DRAFT);
      const wasOpen = localStorage.getItem(LS_TICKET_OPEN) === "true";
      if (raw) {
        const parsed = JSON.parse(raw);
        setForm((prev) => ({ ...prev, ...parsed }));
        if (wasOpen) setOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    setForm((prev) => ({
      ...prev,
      url: window.location.href,
      path: window.location.pathname,
      pageTitle: document.title,
      userAgent: navigator.userAgent,
      selection: selectionText || prev.selection,
    }));
  }, [open, selectionText]);

  const isDirty = form.title.trim().length > 0 || form.notes.trim().length > 0;

  // Persist draft while typing
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDirty) {
      localStorage.setItem(LS_TICKET_DRAFT, JSON.stringify({ title: form.title, notes: form.notes, category: form.category }));
    } else {
      localStorage.removeItem(LS_TICKET_DRAFT);
    }
  }, [form.title, form.notes, form.category, isDirty]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty && !isSubmitting) {
      setShowDiscardConfirm(true);
      return;
    }
    setOpen(nextOpen);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_TICKET_OPEN, String(nextOpen));
    }
    if (!nextOpen && !isSubmitting) {
      setForm({ title: "", notes: "", category: "issue" });
    }
  };

  const confirmDiscard = () => {
    setOpen(false);
    setShowDiscardConfirm(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_TICKET_OPEN, "false");
      localStorage.removeItem(LS_TICKET_DRAFT);
    }
    setForm({ title: "", notes: "", category: "issue" });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const whoamiData = whoami as WhoamiData | undefined;
      const submitter: TicketSubmitter = {
        id: whoamiData?.id ?? whoamiData?.user?.id ?? null,
        name:
          whoamiData?.name ??
          whoamiData?.user?.name ??
          whoamiData?.user?.firstName ??
          whoamiData?.email ??
          whoamiData?.user?.email ??
          null,
        email: whoamiData?.email ?? whoamiData?.user?.email ?? null,
      };

      const detectDeviceType = (ua: string): DeviceType => {
        if (/ipad|tablet/i.test(ua)) return "tablet";
        if (/mobi|android|iphone/i.test(ua)) return "mobile";
        return "desktop";
      };

      const client: TicketClient | undefined =
        typeof window !== "undefined"
          ? {
              userAgent: navigator.userAgent,
              platform: (navigator.platform as string | undefined) ?? null,
              language: navigator.language ?? null,
              deviceType: detectDeviceType(navigator.userAgent),
            }
          : undefined;

      const payload = {
        ...form,
        extra: {
          viewport: typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : undefined,
          referrer: typeof document !== "undefined" ? document.referrer : undefined,
        },
        submitter,
        category: form.category,
        client,
      };

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to submit ticket (${res.status})`);
      }

      setOpen(false);
      setForm({ title: "", notes: "", category: "issue" });
      if (typeof window !== "undefined") {
        localStorage.removeItem(LS_TICKET_DRAFT);
        localStorage.removeItem(LS_TICKET_OPEN);
      }
      toast({
        title: "Ticket submitted",
        description: "We captured the page details.",
        action: (
          <ToastAction altText="View tickets" onClick={() => window.open("/tickets", "_blank")}>
            View
          </ToastAction>
        ),
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Submission failed",
        description: "Could not save the ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[1200] flex flex-col items-end gap-2">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button size="lg" variant="default" className="shadow-lg">
            Submit ticket
          </Button>
        </DialogTrigger>
        <DialogContent
          className="max-w-lg"
          onRequestClose={() => {
            if (isDirty) {
              setShowDiscardConfirm(true);
              return false;
            }
            return true;
          }}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Fast lane</p>
                <DialogTitle className="text-xl">Report, ask, or request</DialogTitle>
                <p className="text-sm text-slate-600">We auto-capture URL, device, and page context for you.</p>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                {form.category === "issue" ? "Bug" : form.category === "feature" ? "Feature" : form.category === "question" ? "Question" : "Other"}
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-900">Type</label>
              <Select
                value={form.category}
                onValueChange={(val: TicketForm["category"]) => setForm((prev) => ({ ...prev, category: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose type" />
                </SelectTrigger>
                <SelectContent className="z-[1400]">
                  <SelectItem value="issue">Issue / bug</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="feature">Feature request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {[
                  { id: "issue", label: "Issue" },
                  { id: "question", label: "Question" },
                  { id: "feature", label: "Feature" },
                  { id: "other", label: "Other" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, category: opt.id as TicketForm["category"] }))}
                    className={`rounded-full border px-2 py-1 ${
                      form.category === opt.id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-900">What happened? (title)</label>
              <Input
                placeholder="e.g., “Filter drawer won't open on mobile”"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-900">
                Steps / details <span className="text-slate-500 text-xs">(optional)</span>
              </label>
              <Textarea
                placeholder="Steps to reproduce, expected vs actual, error text, or your idea. Add any quick notes."
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <div className="text-[11px] text-slate-500">
                We’ll auto-attach: URL, page title, device, selection, viewport. Paste links or repro GIFs if helpful.
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-600">
              {form.url && (
                <div className="break-all">
                  <span className="font-semibold">URL:</span> {form.url}
                </div>
              )}
              {form.path && (
                <div className="break-all">
                  <span className="font-semibold">Path:</span> {form.path}
                </div>
              )}
              {form.pageTitle && (
                <div className="break-all">
                  <span className="font-semibold">Page:</span> {form.pageTitle}
                </div>
              )}
              {form.selection && (
                <div className="break-all">
                  <span className="font-semibold">Selection:</span> “{form.selection}”
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <div className="flex w-full justify-between items-center gap-3">
              <div className="text-xs text-slate-500">Your report keeps working—even if you close this page.</div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !form.title.trim()}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <a
        href="/tickets"
        className="text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
        target="_blank"
        rel="noreferrer"
      >
        View tickets
      </a>

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close and discard this ticket draft? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscard}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
