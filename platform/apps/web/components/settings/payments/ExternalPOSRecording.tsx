"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Smartphone,
  Plus,
  Search,
  DollarSign,
  Calendar,
  Hash,
  FileText,
  History,
  CreditCard,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExternalPOSRecordingProps {
  campgroundId: string;
}

type POSProvider = "square" | "clover" | "toast" | "other";

const POS_PROVIDERS: { id: POSProvider; label: string; color: string }[] = [
  { id: "square", label: "Square", color: "bg-black" },
  { id: "clover", label: "Clover", color: "bg-emerald-600" },
  { id: "toast", label: "Toast", color: "bg-orange-500" },
  { id: "other", label: "Other", color: "bg-muted" },
];

interface ExternalPayment {
  id: string;
  provider: POSProvider;
  amount: number;
  referenceNumber: string;
  description: string;
  createdAt: string;
  recordedBy: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function ExternalPOSRecording({ campgroundId }: ExternalPOSRecordingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);

  // Record form state
  const [provider, setProvider] = useState<POSProvider>("square");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // Format for datetime-local
  });

  // Mock data for external payments - in production this would come from an API
  const [externalPayments, setExternalPayments] = useState<ExternalPayment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Filter by search term
  const filteredPayments = useMemo(() => {
    if (!searchTerm) return externalPayments;
    const term = searchTerm.toLowerCase();
    return externalPayments.filter(
      (p) =>
        p.referenceNumber.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.provider.toLowerCase().includes(term)
    );
  }, [externalPayments, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPayments = externalPayments.filter((p) => {
      const date = new Date(p.createdAt);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime();
    });

    return {
      totalCount: externalPayments.length,
      totalAmount: externalPayments.reduce((sum, p) => sum + p.amount, 0),
      todayCount: todayPayments.length,
      todayAmount: todayPayments.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [externalPayments]);

  const handleRecord = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid dollar amount.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call - in production this would call a real endpoint
    await new Promise((resolve) => setTimeout(resolve, 800));

    const newPayment: ExternalPayment = {
      id: `ext-${Date.now()}`,
      provider,
      amount: cents,
      referenceNumber: referenceNumber || `REF-${Date.now()}`,
      description: description || "External POS payment",
      createdAt: paymentDate,
      recordedBy: "Current User",
    };

    setExternalPayments((prev) => [newPayment, ...prev]);
    setShowSuccess(true);

    toast({
      title: "Payment recorded!",
      description: `${formatCurrency(cents)} from ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
    });

    // Reset form after delay
    setTimeout(() => {
      setIsRecordDialogOpen(false);
      setShowSuccess(false);
      setAmount("");
      setReferenceNumber("");
      setDescription("");
      setPaymentDate(new Date().toISOString().slice(0, 16));
      setIsSubmitting(false);
    }, 1500);
  };

  const getProviderInfo = (providerId: POSProvider) => {
    return POS_PROVIDERS.find((p) => p.id === providerId) || POS_PROVIDERS[3];
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Total Recorded</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalCount}</p>
        </div>
        <div className="bg-status-success-bg rounded-xl p-4 border border-status-success-border">
          <div className="flex items-center gap-2 text-status-success mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Total Amount</span>
          </div>
          <p className="text-2xl font-bold text-status-success-text">{formatCurrency(stats.totalAmount)}</p>
        </div>
        <div className="bg-status-info-bg rounded-xl p-4 border border-status-info-border">
          <div className="flex items-center gap-2 text-status-info mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Today</span>
          </div>
          <p className="text-2xl font-bold text-status-info-text">{stats.todayCount}</p>
        </div>
        <div className="bg-status-warning-bg rounded-xl p-4 border border-status-warning-border">
          <div className="flex items-center gap-2 text-status-warning mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-medium">Today&apos;s Total</span>
          </div>
          <p className="text-2xl font-bold text-status-warning-text">{formatCurrency(stats.todayAmount)}</p>
        </div>
      </div>

      {/* Info Banner */}
      <div
        className="p-4 bg-status-warning-bg border border-status-warning-border rounded-xl"
        role="status"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-status-warning/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-status-warning" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-foreground">Record External Payments</p>
            <p className="text-sm text-status-warning-text mt-1">
              Use this feature to log payments processed through external POS systems (Square, Clover, etc.) so they appear in your reports.
            </p>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Record Payment Dialog */}
        <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover">
              <Plus className="w-4 h-4" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                Record External Payment
              </DialogTitle>
              <DialogDescription>
                Log a payment that was processed through an external POS system.
              </DialogDescription>
            </DialogHeader>

            {showSuccess ? (
              <div className="py-8 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in">
                <div className="w-16 h-16 bg-status-success-bg rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-status-success" />
                </div>
                <h3 className="font-medium text-lg text-foreground">Payment Recorded!</h3>
                <p className="text-muted-foreground mt-1">The payment has been added to your records.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-4">
                  {/* POS Provider */}
                  <div className="space-y-2">
                    <Label htmlFor="pos-provider">POS Provider</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as POSProvider)}>
                      <SelectTrigger id="pos-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {POS_PROVIDERS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3 h-3 rounded-full", p.color)} />
                              {p.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="payment-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Reference Number */}
                  <div className="space-y-2">
                    <Label htmlFor="reference-number">
                      Reference Number <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="reference-number"
                        placeholder="Transaction ID from POS"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Date/Time */}
                  <div className="space-y-2">
                    <Label htmlFor="payment-date">Payment Date & Time</Label>
                    <Input
                      id="payment-date"
                      type="datetime-local"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="payment-description">
                      Description <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="payment-description"
                      placeholder="Add notes about this payment..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRecord}
                    disabled={isSubmitting || !amount}
                    className="bg-muted hover:bg-muted"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      "Record Payment"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5 text-muted-foreground" />
            Recorded Payments
          </CardTitle>
          <CardDescription>
            External POS payments logged in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center">
              <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-foreground mb-1">No payments recorded</h3>
              <p className="text-sm text-muted-foreground mb-4">
                External POS payments will appear here once recorded.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsRecordDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Record First Payment
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPayments.map((payment) => {
                const providerInfo = getProviderInfo(payment.provider);
                return (
                  <div
                    key={payment.id}
                    className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-muted transition-colors"
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        providerInfo.color
                      )}
                    >
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {payment.description}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {providerInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(payment.createdAt)}</span>
                        {payment.referenceNumber && (
                          <>
                            <span>•</span>
                            <code className="font-mono">{payment.referenceNumber}</code>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
