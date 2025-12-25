"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileDown } from "lucide-react";
import { TableEmpty } from "@/components/ui/table";

export default function PrivacySettingsPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [consentForm, setConsentForm] = useState({ subject: "", consentType: "marketing", method: "digital", purpose: "marketing", grantedBy: "" });
  const [piiForm, setPiiForm] = useState({ resource: "guest", field: "email", classification: "sensitive", redactionMode: "mask" });
  const [testPayload, setTestPayload] = useState(() =>
    JSON.stringify(
      {
        resource: "guest",
        sample: {
          email: "guest@example.com",
          phone: "555-222-3333",
          notes: "Call Anna tomorrow at 555-000-9999"
        }
      },
      null,
      2
    )
  );
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const qc = useQueryClient();

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const settingsQuery = useQuery({
    queryKey: ["privacy-settings", campgroundId],
    queryFn: () => apiClient.getPrivacySettings(campgroundId!),
    enabled: !!campgroundId
  });

  const consentsQuery = useQuery({
    queryKey: ["consents", campgroundId],
    queryFn: () => apiClient.listConsents(campgroundId!),
    enabled: !!campgroundId
  });

  const tagsQuery = useQuery({
    queryKey: ["pii-tags", campgroundId],
    queryFn: () => apiClient.listPiiTags(campgroundId!),
    enabled: !!campgroundId
  });

  const redactionsQuery = useQuery({
    queryKey: ["recent-redactions", campgroundId],
    queryFn: () => apiClient.listRecentRedactions(campgroundId!),
    enabled: !!campgroundId
  });

  const updateSettings = useMutation({
    mutationFn: (payload: any) => apiClient.updatePrivacySettings(campgroundId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy-settings", campgroundId] })
  });

  const exportPrivacy = useMutation({
    mutationFn: async (format: "json" | "csv") => {
      const payload = await apiClient.exportPrivacyBundle(campgroundId!, format);
      return { format, payload };
    },
    onSuccess: ({ format, payload }) => {
      if (!campgroundId) return;
      if (format === "csv") {
        const csv = payload as { content: string; contentType?: string };
        downloadFile(csv.content, `privacy-consent-${campgroundId}.csv`, csv.contentType ?? "text/csv");
        return;
      }
      downloadFile(JSON.stringify(payload, null, 2), `privacy-consent-${campgroundId}.json`, "application/json");
    }
  });

  const recordConsent = useMutation({
    mutationFn: () => apiClient.recordConsent(campgroundId!, consentForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consents", campgroundId] });
      setConsentForm({ subject: "", consentType: "marketing", method: "digital", purpose: "marketing", grantedBy: "" });
    }
  });

  const upsertTag = useMutation({
    mutationFn: () => apiClient.upsertPiiTag(campgroundId!, piiForm),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pii-tags", campgroundId] })
  });

  const previewRedaction = useMutation({
    mutationFn: async () => {
      setPreviewError(null);
      let parsed: any;
      try {
        parsed = JSON.parse(testPayload);
      } catch (err: any) {
        setPreviewError("Test payload must be valid JSON");
        throw err;
      }
      return apiClient.previewRedaction(campgroundId!, parsed);
    },
    onSuccess: (data) => setPreviewResult(data),
    onError: () => setPreviewResult(null)
  });

  const settings = settingsQuery.data;

  const updateField = (key: string, value: any) => {
    if (!settings) return;
    updateSettings.mutate({ [key]: value });
  };

  const retentionLabel = useMemo(() => `${settings?.backupRetentionDays ?? 0} days`, [settings?.backupRetentionDays]);

  return (
    <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Settings" }, { label: "Privacy & PII" }]} />

        {/* How It Works Section */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🔐</div>
            <div className="space-y-2">
              <h4 className="font-semibold text-emerald-900">How Privacy Settings Work</h4>
              <div className="text-sm text-slate-700 space-y-1">
                <p><strong>DSR Export:</strong> Generate Data Subject Request exports for GDPR/CCPA compliance. Downloads all PII rules and consent records for a guest or campground.</p>
                <p><strong>Redaction Dashboard:</strong> Test how your PII rules work by running sample data through the redaction engine. Great for verifying your privacy setup.</p>
                <p><strong>Privacy Defaults:</strong> Enable/disable PII redaction in logs, require consent for communications, and set backup retention windows.</p>
                <p><strong>Consent Log:</strong> Track when and how guests gave consent for data processing—required for marketing communications in some regions.</p>
                <p><strong>PII Tags:</strong> Define which fields contain sensitive data and how they should be handled (masked or removed).</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">DSR / consent export</div>
              <div className="text-sm text-slate-600">Exports PII redaction defaults and consent log (stubbed data shape).</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => exportPrivacy.mutate("json")}
                disabled={!campgroundId || exportPrivacy.isPending}
              >
                <FileDown className="w-4 h-4 mr-2" />
                {exportPrivacy.isPending ? "Preparing..." : "Export JSON"}
              </Button>
              <Button
                size="sm"
                onClick={() => exportPrivacy.mutate("csv")}
                disabled={!campgroundId || exportPrivacy.isPending}
              >
                <FileDown className="w-4 h-4 mr-2" />
                {exportPrivacy.isPending ? "Preparing..." : "Export CSV"}
              </Button>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Downloads a stub bundle; wire to real storage once privacy export is GA.
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Privacy redaction dashboard</div>
              <div className="text-sm text-slate-600">Quick view into rules, recent redactions, and a stubbed test harness.</div>
            </div>
            <Button
              size="sm"
              onClick={() => previewRedaction.mutate()}
              disabled={!campgroundId || previewRedaction.isPending}
              variant="secondary"
            >
              {previewRedaction.isPending ? "Testing..." : "Run test redaction"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="rounded border border-slate-200 p-3">
                <div className="text-sm font-semibold mb-2">Current redaction rules</div>
                <div className="text-xs text-slate-500 mb-2">Showing the first few PII tags (full list below).</div>
                <div className="flex flex-col gap-2">
                  {(tagsQuery.data ?? []).slice(0, 5).map((tag: any) => (
                    <div key={`${tag.resource}:${tag.field}`} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{tag.resource}.{tag.field}</span>
                      <span className="text-slate-500 uppercase text-[11px]">{tag.classification} • {tag.redactionMode}</span>
                    </div>
                  ))}
                  {(tagsQuery.data ?? []).length === 0 && (
                    <div className="overflow-hidden rounded border border-slate-200 bg-white">
                      <table className="w-full text-sm">
                        <tbody>
                          <TableEmpty>No PII tags yet.</TableEmpty>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded border border-slate-200 p-3">
                <div className="text-sm font-semibold mb-2">Recent redactions</div>
                <div className="text-xs text-slate-500 mb-2">Audit samples scrubbed for PII.</div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {(redactionsQuery.data ?? []).map((row: any) => (
                    <div key={row.id} className="border border-slate-100 rounded p-2 text-sm">
                      <div className="flex items-center justify-between text-slate-700">
                        <span>{row.action} {row.entity}</span>
                        <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">Entity ID: {row.entityId ?? "n/a"}</div>
                      {row.sample ? (
                        <pre className="bg-slate-50 text-xs rounded p-2 mt-2 whitespace-pre-wrap break-all">
                          {JSON.stringify(row.sample, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                  {(redactionsQuery.data ?? []).length === 0 && (
                    <div className="overflow-hidden rounded border border-slate-200 bg-white">
                      <table className="w-full text-sm">
                        <tbody>
                          <TableEmpty>No redactions recorded yet.</TableEmpty>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Test redaction (stub)</div>
                  <div className="text-xs text-slate-500">Sends sample payload to the preview endpoint only.</div>
                </div>
              </div>
              <Textarea
                className="min-h-[200px] font-mono text-xs"
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                disabled={!campgroundId || previewRedaction.isPending}
              />
              {previewError && <div className="text-xs text-red-600">{previewError}</div>}
              {previewResult ? (
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold mb-1">Preview output</div>
                  <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(previewResult, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="overflow-hidden rounded border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <tbody>
                      <TableEmpty>No preview yet.</TableEmpty>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Privacy defaults</div>
              <div className="text-sm text-slate-600">Redaction, retention, and consent requirements.</div>
            </div>
            <div className="text-xs text-slate-500">Campground: {campgroundId ?? "not selected"}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2">
              <span className="text-sm text-slate-700">Redact PII in audit/logs</span>
              <input
                type="checkbox"
                checked={!!settings?.redactPII}
                onChange={(e) => updateField("redactPII", e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2">
              <span className="text-sm text-slate-700">Consent required for communications</span>
              <input
                type="checkbox"
                checked={!!settings?.consentRequired}
                onChange={(e) => updateField("consentRequired", e.target.checked)}
              />
            </label>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Backup retention (days)</Label>
              <Input
                type="number"
                value={settings?.backupRetentionDays ?? ""}
                onChange={(e) => updateField("backupRetentionDays", Number(e.target.value))}
              />
              <div className="text-xs text-slate-500">{retentionLabel}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Key rotation (days)</Label>
              <Input
                type="number"
                value={settings?.keyRotationDays ?? ""}
                onChange={(e) => updateField("keyRotationDays", Number(e.target.value))}
              />
              <div className="text-xs text-slate-500">Rotate keys on this cadence.</div>
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Consent log</div>
              <div className="text-sm text-slate-600">Capture and view consent events.</div>
            </div>
            <Button size="sm" onClick={() => recordConsent.mutate()} disabled={!campgroundId || recordConsent.isPending}>
              {recordConsent.isPending ? "Saving..." : "Record consent"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label className="text-sm">Subject</Label>
              <Input value={consentForm.subject} onChange={(e) => setConsentForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Type</Label>
              <Input value={consentForm.consentType} onChange={(e) => setConsentForm((f) => ({ ...f, consentType: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Method</Label>
              <Select value={consentForm.method} onValueChange={(v) => setConsentForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="written">Written</SelectItem>
                  <SelectItem value="verbal">Verbal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Granted by</Label>
              <Input value={consentForm.grantedBy} onChange={(e) => setConsentForm((f) => ({ ...f, grantedBy: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm">Purpose</Label>
              <Input value={consentForm.purpose} onChange={(e) => setConsentForm((f) => ({ ...f, purpose: e.target.value }))} />
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b">
                <tr>
                  <th className="py-2">Subject</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Purpose</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">Granted</th>
                </tr>
              </thead>
              <tbody>
                {(consentsQuery.data ?? []).map((c) => (
                  <tr key={c.id} className="border-b last:border-b-0">
                    <td className="py-2">{c.subject}</td>
                    <td className="py-2">{c.consentType}</td>
                    <td className="py-2">{c.purpose ?? "—"}</td>
                    <td className="py-2">{c.method ?? "—"}</td>
                    <td className="py-2">{new Date(c.grantedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">PII fields & redaction</div>
              <div className="text-sm text-slate-600">Classify fields for masking or removal.</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => upsertTag.mutate()} disabled={!campgroundId || upsertTag.isPending}>
              {upsertTag.isPending ? "Saving..." : "Save tag"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-sm">Resource</Label>
              <Input value={piiForm.resource} onChange={(e) => setPiiForm((f) => ({ ...f, resource: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Field</Label>
              <Input value={piiForm.field} onChange={(e) => setPiiForm((f) => ({ ...f, field: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Classification</Label>
              <Select value={piiForm.classification} onValueChange={(v) => setPiiForm((f) => ({ ...f, classification: v }))}>
                <SelectTrigger><SelectValue placeholder="Classification" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="sensitive">Sensitive</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Redaction</Label>
              <Select value={piiForm.redactionMode} onValueChange={(v) => setPiiForm((f) => ({ ...f, redactionMode: v }))}>
                <SelectTrigger><SelectValue placeholder="Redaction" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mask">Mask</SelectItem>
                  <SelectItem value="remove">Remove</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b">
                <tr>
                  <th className="py-2">Resource</th>
                  <th className="py-2">Field</th>
                  <th className="py-2">Class</th>
                  <th className="py-2">Redaction</th>
                </tr>
              </thead>
              <tbody>
                {(tagsQuery.data ?? []).map((tag: any) => (
                  <tr key={`${tag.resource}:${tag.field}`} className="border-b last:border-b-0">
                    <td className="py-2">{tag.resource}</td>
                    <td className="py-2">{tag.field}</td>
                    <td className="py-2 uppercase text-xs">{tag.classification}</td>
                    <td className="py-2">{tag.redactionMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}

