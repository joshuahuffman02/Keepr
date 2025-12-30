"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import { apiClient } from "../../lib/api-client";
import { useToast } from "../../components/ui/use-toast";
import { cn } from "../../lib/utils";
import {
  FileSignature, Download, FileText, Search, Filter, MoreVertical,
  CheckCircle2, Clock, Eye, Send, X, AlertTriangle, Calendar,
  Users, TrendingUp, Loader2, Upload, Ban, RefreshCw, ChevronDown,
  Megaphone, UserCheck, FileX, PenLine
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

interface ContractStats {
  total: number;
  preview: number;
  draft: number;
  sent: number;
  viewed: number;
  signed: number;
  signedPaper: number;
  waived: number;
  declined: number;
  expired: number;
  voided: number;
  completionRate: number;
  pendingCount: number;
  daysUntilDeadline?: number;
}

interface Contract {
  id: string;
  status: string;
  documentType: string;
  recipientName: string | null;
  recipientEmail: string | null;
  signatureMethod: string;
  seasonYear: number | null;
  createdAt: string;
  sentAt: string | null;
  signedAt: string | null;
  paperSignedAt: string | null;
  waivedAt: string | null;
  expiresAt: string | null;
  waiverReason: string | null;
  waiverNotes: string | null;
  guest: {
    id: string;
    primaryFirstName: string;
    primaryLastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  template: {
    id: string;
    name: string;
    type: string;
  } | null;
  artifact: {
    id: string;
    pdfUrl: string;
    completedAt: string | null;
  } | null;
  reservation: {
    id: string;
    arrivalDate: string;
    departureDate: string;
    siteId: string | null;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  preview: { label: "Preview", color: "bg-purple-100 text-purple-700", icon: <Eye className="h-3 w-3" /> },
  draft: { label: "Draft", color: "bg-slate-100 text-slate-600", icon: <FileText className="h-3 w-3" /> },
  sent: { label: "Sent", color: "bg-status-info/15 text-status-info border-status-info/30", icon: <Send className="h-3 w-3" /> },
  viewed: { label: "Viewed", color: "bg-status-warning/15 text-status-warning border-status-warning/30", icon: <Eye className="h-3 w-3" /> },
  signed: { label: "Signed", color: "bg-status-success/15 text-status-success border-status-success/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  signed_paper: { label: "Paper Signed", color: "bg-status-success/15 text-status-success border-status-success/30", icon: <PenLine className="h-3 w-3" /> },
  waived: { label: "Waived", color: "bg-teal-100 text-teal-700", icon: <UserCheck className="h-3 w-3" /> },
  declined: { label: "Declined", color: "bg-status-error/15 text-status-error border-status-error/30", icon: <X className="h-3 w-3" /> },
  voided: { label: "Voided", color: "bg-slate-200 text-slate-600", icon: <Ban className="h-3 w-3" /> },
  expired: { label: "Expired", color: "bg-status-warning/15 text-status-warning border-status-warning/30", icon: <Clock className="h-3 w-3" /> },
};

const waiverReasonLabels: Record<string, string> = {
  returning_same_terms: "Returning - Same Terms",
  corporate_agreement: "Corporate Agreement",
  grandfathered: "Grandfathered",
  family_member: "Family Member",
  owner_discretion: "Owner Discretion",
  other: "Other",
};

const documentTypeLabels: Record<string, string> = {
  seasonal: "Seasonal",
  long_term_stay: "Long-Term",
  monthly: "Monthly",
  park_rules: "Park Rules",
  deposit: "Deposit",
  waiver: "Waiver",
  coi: "COI",
  other: "Other",
};

// Stats Dashboard Component
function ContractStatsDashboard({ stats, isLoading }: { stats: ContractStats | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const completed = stats.signed + stats.signedPaper + stats.waived;

  return (
    <div className="space-y-4">
      {/* Main Progress */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Contract Completion</h3>
            <p className="text-sm text-slate-600">
              {completed} of {stats.total} contracts completed
            </p>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{stats.completionRate}%</div>
        </div>
        <Progress value={stats.completionRate} className="h-3" />
        {stats.daysUntilDeadline !== undefined && stats.daysUntilDeadline > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {stats.daysUntilDeadline} days until earliest deadline
          </p>
        )}
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Signed (Digital)" value={stats.signed} icon={<CheckCircle2 className="h-4 w-4" />} color="emerald" />
        <StatCard label="Signed (Paper)" value={stats.signedPaper} icon={<PenLine className="h-4 w-4" />} color="emerald" />
        <StatCard label="Waived" value={stats.waived} icon={<UserCheck className="h-4 w-4" />} color="teal" />
        <StatCard label="Pending" value={stats.pendingCount} icon={<Clock className="h-4 w-4" />} color="amber" />
        <StatCard label="Expired/Declined" value={stats.expired + stats.declined} icon={<AlertTriangle className="h-4 w-4" />} color="red" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-status-success/15 text-status-success border-status-success/30",
    teal: "bg-teal-50 text-teal-600 border-teal-200",
    amber: "bg-status-warning/15 text-status-warning border-status-warning/30",
    red: "bg-status-error/15 text-status-error border-status-error/30",
    blue: "bg-status-info/15 text-status-info border-status-info/30",
  };

  return (
    <div className={cn("rounded-lg border p-3", colorClasses[color])}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// Paper Signing Modal
function PaperSignedModal({
  open,
  onClose,
  contract,
  onSubmit,
  isLoading
}: {
  open: boolean;
  onClose: () => void;
  contract: Contract | null;
  onSubmit: (data: { paperSignedAt?: string; paperArtifactUrl?: string; notes?: string }) => void;
  isLoading: boolean;
}) {
  const [paperSignedAt, setPaperSignedAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setPaperSignedAt(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-emerald-500" />
            Mark as Paper Signed
          </DialogTitle>
          <DialogDescription>
            Record that {contract?.guest?.primaryFirstName} {contract?.guest?.primaryLastName} signed the contract on paper.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paperSignedAt">Date Signed</Label>
            <Input
              id="paperSignedAt"
              type="date"
              value={paperSignedAt}
              onChange={(e) => setPaperSignedAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any notes about the paper signing..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSubmit({ paperSignedAt, notes: notes || undefined })}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PenLine className="h-4 w-4 mr-2" />}
            Mark as Signed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Waive Signature Modal
function WaiveSignatureModal({
  open,
  onClose,
  contract,
  onSubmit,
  isLoading
}: {
  open: boolean;
  onClose: () => void;
  contract: Contract | null;
  onSubmit: (data: { reason: string; notes?: string }) => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setNotes("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-teal-500" />
            Waive Signature Requirement
          </DialogTitle>
          <DialogDescription>
            Waive the signature requirement for {contract?.guest?.primaryFirstName} {contract?.guest?.primaryLastName}.
            The contract will be marked as complete without a signature.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reason for Waiver</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="returning_same_terms">Returning Guest - Same Terms</SelectItem>
                <SelectItem value="corporate_agreement">Corporate Agreement on File</SelectItem>
                <SelectItem value="grandfathered">Grandfathered Terms</SelectItem>
                <SelectItem value="family_member">Family Member on Existing Contract</SelectItem>
                <SelectItem value="owner_discretion">Owner Discretion</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="waiverNotes">Notes {reason === "other" && <span className="text-red-500">*</span>}</Label>
            <Textarea
              id="waiverNotes"
              placeholder={reason === "other" ? "Required - explain why signature is being waived" : "Optional notes..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSubmit({ reason, notes: notes || undefined })}
            disabled={isLoading || !reason || (reason === "other" && !notes)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
            Waive Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Contract Row Component
function ContractRow({
  contract,
  onMarkPaperSigned,
  onWaive,
  onResend,
  onVoid,
  onDownload
}: {
  contract: Contract;
  onMarkPaperSigned: () => void;
  onWaive: () => void;
  onResend: () => void;
  onVoid: () => void;
  onDownload: () => void;
}) {
  const status = statusConfig[contract.status] || statusConfig.draft;
  const guestName = contract.guest
    ? `${contract.guest.primaryFirstName} ${contract.guest.primaryLastName}`.trim()
    : contract.recipientName || "Unknown";

  const isPending = ["sent", "viewed"].includes(contract.status);
  const isCompleted = ["signed", "signed_paper", "waived"].includes(contract.status);
  const canModify = !["voided", "expired", "signed", "signed_paper", "waived", "declined"].includes(contract.status);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{guestName}</span>
            <Badge className={cn("text-xs flex items-center gap-1", status.color)}>
              {status.icon}
              {status.label}
            </Badge>
            {contract.seasonYear && (
              <Badge variant="outline" className="text-xs">{contract.seasonYear}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{documentTypeLabels[contract.documentType] || contract.documentType}</span>
            {contract.template && (
              <>
                <span>•</span>
                <span>{contract.template.name}</span>
              </>
            )}
            {contract.guest?.email && (
              <>
                <span>•</span>
                <span>{contract.guest.email}</span>
              </>
            )}
          </div>
          {contract.status === "waived" && contract.waiverReason && (
            <div className="text-xs text-teal-600">
              Waived: {waiverReasonLabels[contract.waiverReason] || contract.waiverReason}
              {contract.waiverNotes && ` - ${contract.waiverNotes}`}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isCompleted && contract.artifact?.pdfUrl && (
          <Button size="sm" variant="outline" onClick={onDownload}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
        )}
        {isPending && (
          <Button size="sm" variant="outline" onClick={onResend}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Resend
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canModify && (
              <>
                <DropdownMenuItem onClick={onMarkPaperSigned}>
                  <PenLine className="h-4 w-4 mr-2" />
                  Mark as Paper Signed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onWaive}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Waive Signature
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </DropdownMenuItem>
            {canModify && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onVoid} className="text-red-600">
                  <Ban className="h-4 w-4 mr-2" />
                  Void Contract
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Renewal Campaign Modal
function RenewalCampaignModal({
  open,
  onClose,
  campgroundId,
  onSuccess
}: {
  open: boolean;
  onClose: () => void;
  campgroundId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [seasonYear, setSeasonYear] = useState(String(currentYear + 1));
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // In a real implementation, this would fetch previous seasonals and templates
  // For now, we'll show a placeholder UI

  const handleSend = async () => {
    setIsLoading(true);
    try {
      // This would call the renewal campaign API
      toast({
        title: "Coming Soon",
        description: "Renewal campaign functionality will be available soon. You can manually create contracts for now."
      });
      onClose();
    } catch {
      toast({ title: "Failed to send campaign", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" />
            Send Renewal Campaign
          </DialogTitle>
          <DialogDescription>
            Send seasonal contract renewals to previous guests. Contracts will be sent based on seniority and availability.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Season Year</Label>
            <Select value={seasonYear} onValueChange={setSeasonYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(currentYear + 1)}>{currentYear + 1}</SelectItem>
                <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Email Subject (optional)</Label>
            <Input
              placeholder={`${seasonYear} Seasonal Contract`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              placeholder="Add a personal message to your renewal invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 p-3 text-sm text-status-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Coming Soon:</strong> This feature will automatically identify returning seasonals and send renewal contracts based on configurable priority rules.
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Preview Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Contracts Tab Component
export function ContractsTab({ campgroundId }: { campgroundId: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [paperSignedContract, setPaperSignedContract] = useState<Contract | null>(null);
  const [waiveContract, setWaiveContract] = useState<Contract | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  const currentYear = new Date().getFullYear();
  const seasonYears = [currentYear + 1, currentYear, currentYear - 1];

  // Query contract stats
  const statsQuery = useQuery({
    queryKey: ["contract-stats", campgroundId, seasonFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ campgroundId: campgroundId! });
      if (seasonFilter !== "all") params.append("seasonYear", seasonFilter);
      const res = await fetch(`/api/signatures/contracts/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json() as Promise<ContractStats>;
    },
    enabled: !!campgroundId,
  });

  // Query contracts list
  const contractsQuery = useQuery({
    queryKey: ["contracts", campgroundId, statusFilter, seasonFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ campgroundId: campgroundId! });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (seasonFilter !== "all") params.append("seasonYear", seasonFilter);
      const res = await fetch(`/api/signatures/contracts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contracts");
      const data = await res.json();
      return data as { contracts: Contract[]; total: number };
    },
    enabled: !!campgroundId,
  });

  // Mark paper signed mutation
  const paperSignedMutation = useMutation({
    mutationFn: async (data: { id: string; paperSignedAt?: string; notes?: string }) => {
      const res = await fetch(`/api/signatures/requests/${data.id}/paper-signed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperSignedAt: data.paperSignedAt, notes: data.notes }),
      });
      if (!res.ok) throw new Error("Failed to mark as paper signed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract-stats"] });
      setPaperSignedContract(null);
      toast({ title: "Contract marked as paper signed" });
    },
    onError: () => {
      toast({ title: "Failed to mark as paper signed", variant: "destructive" });
    },
  });

  // Waive signature mutation
  const waiveMutation = useMutation({
    mutationFn: async (data: { id: string; reason: string; notes?: string }) => {
      const res = await fetch(`/api/signatures/requests/${data.id}/waive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: data.reason, notes: data.notes }),
      });
      if (!res.ok) throw new Error("Failed to waive signature");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract-stats"] });
      setWaiveContract(null);
      toast({ title: "Signature requirement waived" });
    },
    onError: () => {
      toast({ title: "Failed to waive signature", variant: "destructive" });
    },
  });

  // Resend mutation
  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/signatures/requests/${id}/resend`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to resend");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contract resent to guest" });
    },
    onError: () => {
      toast({ title: "Failed to resend contract", variant: "destructive" });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/signatures/requests/${id}/void`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to void");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract-stats"] });
      toast({ title: "Contract voided" });
    },
    onError: () => {
      toast({ title: "Failed to void contract", variant: "destructive" });
    },
  });

  // Download PDF
  const handleDownload = async (contract: Contract) => {
    try {
      const res = await fetch(`/api/signatures/requests/${contract.id}/pdf`);
      if (!res.ok) throw new Error("Failed to get PDF");
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else if (data.previewContent) {
        // For preview contracts without signed PDF, show the content
        toast({ title: "Contract not yet signed - showing preview content" });
      }
    } catch {
      toast({ title: "Failed to download PDF", variant: "destructive" });
    }
  };

  // Filter contracts by search
  const filteredContracts = (contractsQuery.data?.contracts || []).filter(c => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const guestName = c.guest ? `${c.guest.primaryFirstName} ${c.guest.primaryLastName}` : c.recipientName || "";
    return guestName.toLowerCase().includes(search) ||
           c.guest?.email?.toLowerCase().includes(search) ||
           c.template?.name?.toLowerCase().includes(search);
  });

  if (!campgroundId) {
    return (
      <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 p-4 text-sm text-status-warning flex items-center gap-3">
        <AlertTriangle className="h-5 w-5" />
        <span>Select a campground from the sidebar to manage contracts.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Paper Signed Modal */}
      <PaperSignedModal
        open={!!paperSignedContract}
        onClose={() => setPaperSignedContract(null)}
        contract={paperSignedContract}
        onSubmit={(data) => paperSignedMutation.mutate({ id: paperSignedContract!.id, ...data })}
        isLoading={paperSignedMutation.isPending}
      />

      {/* Waive Signature Modal */}
      <WaiveSignatureModal
        open={!!waiveContract}
        onClose={() => setWaiveContract(null)}
        contract={waiveContract}
        onSubmit={(data) => waiveMutation.mutate({ id: waiveContract!.id, ...data })}
        isLoading={waiveMutation.isPending}
      />

      {/* Renewal Campaign Modal */}
      {campgroundId && (
        <RenewalCampaignModal
          open={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          campgroundId={campgroundId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["contracts"] });
            queryClient.invalidateQueries({ queryKey: ["contract-stats"] });
          }}
        />
      )}

      {/* Stats Dashboard */}
      <ContractStatsDashboard stats={statsQuery.data || null} isLoading={statsQuery.isLoading} />

      {/* Contracts List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                  <FileSignature className="h-4 w-4" />
                </span>
                Seasonal & Long-Term Contracts
              </CardTitle>
              <CardDescription>
                Manage contracts, track signatures, and handle paper signing or waivers.
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowRenewalModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500"
            >
              <Megaphone className="h-4 w-4 mr-2" />
              Send Renewal Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, or template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {seasonYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent,viewed">Pending</SelectItem>
                <SelectItem value="signed">Signed (Digital)</SelectItem>
                <SelectItem value="signed_paper">Signed (Paper)</SelectItem>
                <SelectItem value="waived">Waived</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contracts List */}
          {contractsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileX className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No contracts found</p>
              <p className="text-sm">Try adjusting your filters or send a renewal campaign to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContracts.map(contract => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  onMarkPaperSigned={() => setPaperSignedContract(contract)}
                  onWaive={() => setWaiveContract(contract)}
                  onResend={() => resendMutation.mutate(contract.id)}
                  onVoid={() => voidMutation.mutate(contract.id)}
                  onDownload={() => handleDownload(contract)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContractsTab;
