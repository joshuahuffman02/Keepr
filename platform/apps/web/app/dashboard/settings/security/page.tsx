"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  Cloud,
  FileDown,
  RefreshCcw,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

type PrivacySettings = {
  redactPII: boolean;
  consentRequired: boolean;
  backupRetentionDays: number;
  keyRotationDays: number;
};

type AuditLogRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actor: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
};

export default function SecuritySettingsPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const quickAuditQuery = useQuery<{
    privacyDefaults: PrivacySettings;
    piiTagCount: number;
    piiTagsPreview: {
      resource: string;
      field: string;
      classification: string;
      redactionMode?: string | null;
    }[];
    auditEvents: AuditLogRow[];
  }>({
    queryKey: ["security-quick-audit", campgroundId],
    queryFn: () => apiClient.getSecurityQuickAudit(campgroundId!),
    enabled: !!campgroundId,
  });

  const backupQuery = useQuery({
    queryKey: ["backup-status", campgroundId],
    queryFn: () => apiClient.getBackupStatus(campgroundId!),
    enabled: !!campgroundId,
    staleTime: 15000,
  });

  const simulateRestore = useMutation({
    mutationFn: () => apiClient.simulateRestore(campgroundId!),
    onSuccess: (data) => {
      toast({
        title: "Restore simulation recorded (stub)",
        description: "No data moved; status updated for DR drills.",
      });
      if (campgroundId) {
        qc.setQueryData(["backup-status", campgroundId], {
          campgroundId,
          lastBackupAt: data.lastBackupAt,
          lastBackupLocation: data.lastBackupLocation,
          retentionDays: data.retentionDays,
          restoreSimulation: data.restoreSimulation,
        });
      }
    },
    onError: (err: unknown) => {
      toast({
        title: "Restore simulation failed",
        description: getErrorMessage(err, "Unexpected error while running the stub drill."),
        variant: "destructive",
      });
    },
  });

  const piiCount = quickAuditQuery.data?.piiTagCount ?? 0;
  const piiTagsPreview = quickAuditQuery.data?.piiTagsPreview ?? [];
  const auditEvents = quickAuditQuery.data?.auditEvents ?? [];
  const latestAudit = auditEvents?.[0];

  const handleRefresh = () => {
    if (!campgroundId) return;
    qc.invalidateQueries({ queryKey: ["security-quick-audit", campgroundId] });
    qc.invalidateQueries({ queryKey: ["backup-status", campgroundId] });
  };

  const handleExport = () => {
    toast({
      title: "Audit export queued (stub)",
      description: "We will email a CSV export once the endpoint is wired.",
      duration: 4200,
    });
  };

  const statusBadge = (on?: boolean) => {
    if (on === undefined) {
      return (
        <Badge variant="outline" className="gap-1">
          <Shield className="w-4 h-4" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant={on ? "default" : "outline"} className="gap-1">
        {on ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
        {on ? "On" : "Off"}
      </Badge>
    );
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "Not yet recorded";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  };

  const restoreStatusBadge = (status?: "idle" | "running" | "ok" | "error") => {
    if (!status) {
      return (
        <Badge variant="outline" className="gap-1">
          <RotateCcw className="w-4 h-4" />
          Pending
        </Badge>
      );
    }
    const variant = status === "ok" ? "default" : status === "running" ? "secondary" : "outline";
    const label =
      status === "ok"
        ? "Healthy"
        : status === "running"
          ? "Running"
          : status === "idle"
            ? "Idle"
            : "Needs review";
    return (
      <Badge variant={variant} className="gap-1">
        <RotateCcw className="w-4 h-4" />
        {label}
      </Badge>
    );
  };

  const settings = quickAuditQuery.data?.privacyDefaults;
  const backupStatus = backupQuery.data;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Settings" }, { label: "Security" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security quick audit</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot of privacy defaults, PII coverage, and recent audit activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={!campgroundId || quickAuditQuery.isLoading}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" variant="secondary" onClick={handleExport} disabled={!campgroundId}>
            <FileDown className="w-4 h-4 mr-2" />
            Export audit
          </Button>
        </div>
      </div>

      {/* How It Works Section */}
      <Card className="bg-status-info/10 border-status-info/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-status-info mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">How Security Settings Work</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Privacy Defaults:</strong> Control how PII (Personally Identifiable
                  Information) is handled across your campground. Toggle redaction to mask sensitive
                  data in logs, and require consent before sending communications.
                </p>
                <p>
                  <strong>PII Tags:</strong> Track which data fields contain sensitive information.
                  These tags determine what gets masked or removed when redaction is enabled.
                </p>
                <p>
                  <strong>Backup & DR:</strong> View your backup status and retention window. Use
                  "Simulate restore" to run disaster recovery drills (no actual data is moved).
                </p>
                <p>
                  <strong>Audit Log:</strong> Review recent security-relevant events like logins,
                  permission changes, and data access.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Privacy defaults</CardTitle>
              <CardDescription>Campground-wide redaction and consent posture.</CardDescription>
            </div>
            <Badge variant="outline">
              {campgroundId ? `Campground ${campgroundId.slice(0, 6)}…` : "No campground selected"}
            </Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Redact PII in logs</div>
                {statusBadge(settings?.redactPII)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Removes or masks PII from audit trails and previews.
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Consent required</div>
                {statusBadge(settings?.consentRequired)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires opt-in before sending outbound communications.
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Backup retention</div>
                <Badge variant="secondary">{settings?.backupRetentionDays ?? "—"} days</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Retention window for encrypted backups.
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Key rotation</div>
                <Badge variant="secondary">{settings?.keyRotationDays ?? "—"} days</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cadence for rotating encryption and signing keys.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PII tags</CardTitle>
            <CardDescription>Classification coverage across resources.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">Tracked fields</div>
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {piiCount}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-2">
              {piiTagsPreview
                .slice(0, 4)
                .map(
                  (tag: {
                    resource: string;
                    field: string;
                    classification: string;
                    redactionMode?: string | null;
                  }) => (
                    <div
                      key={`${tag.resource}:${tag.field}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground">
                        {tag.resource}.{tag.field}
                      </span>
                      <Badge variant="outline" className="text-[11px] uppercase">
                        {tag.classification}
                      </Badge>
                    </div>
                  ),
                )}
              {piiTagsPreview.length === 0 && (
                <div className="overflow-hidden rounded border border-border bg-card">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="px-4 py-6 text-center text-muted-foreground">
                          No PII tags defined yet.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {piiTagsPreview.length > 4 && (
                <div className="text-xs text-muted-foreground">Showing 4 of {piiCount} tags.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Backup & DR readiness</CardTitle>
            <CardDescription>Stub status only; no real restore is executed.</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Cloud className="w-4 h-4" />
            {backupStatus ? `${backupStatus.retentionDays}d` : "—"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {backupQuery.isLoading && (
            <div className="text-sm text-muted-foreground">Loading backup posture…</div>
          )}
          {!backupQuery.isLoading && !backupStatus && (
            <div className="text-sm text-muted-foreground">
              Select a campground to view backup posture.
            </div>
          )}
          {backupStatus && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-foreground">Last backup</div>
                <div className="text-xs text-right text-muted-foreground">
                  <div>{formatDate(backupStatus.lastBackupAt)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {backupStatus.lastBackupLocation}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-foreground">Retention window</div>
                <Badge variant="secondary">{backupStatus.retentionDays} days</Badge>
              </div>
              <div className="rounded border border-border p-3 bg-muted">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Restore simulation (stub)
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Records a drill only — no data moved.
                    </p>
                  </div>
                  {restoreStatusBadge(backupStatus?.restoreSimulation.status)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Last run: {formatDate(backupStatus.restoreSimulation?.lastRunAt)}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => simulateRestore.mutate()}
                    disabled={!campgroundId || simulateRestore.isPending}
                  >
                    {simulateRestore.isPending ? "Simulating..." : "Simulate restore"}
                  </Button>
                  <Badge variant="outline" className="text-xs">
                    {campgroundId ? `Camp ${campgroundId.slice(0, 6)}…` : "No campground"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent audit log</CardTitle>
            <CardDescription>Last 5 security-relevant events from the audit trail.</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Shield className="w-4 h-4" />
            {auditEvents.length} entries
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestAudit ? (
            <div className="rounded border border-border p-3 bg-muted">
              <div className="flex items-center justify-between text-sm text-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">{latestAudit.action}</span>
                  <span className="text-muted-foreground">on {latestAudit.entity}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(latestAudit.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Actor: {latestAudit.actor?.email ?? "unknown"} • Entity ID:{" "}
                {latestAudit.entityId ?? "n/a"}
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-border bg-card">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground">
                      No audit entries yet.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <Separator />

          <div className="grid gap-2">
            {auditEvents.map((row: AuditLogRow) => (
              <div key={row.id} className="rounded border border-border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {row.action} • {row.entity}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Actor: {row.actor?.email ?? "unknown"} | Entity ID: {row.entityId ?? "n/a"}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
