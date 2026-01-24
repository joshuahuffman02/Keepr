"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roles = ["owner", "manager", "front_desk", "maintenance", "finance", "marketing", "readonly"];
const effects = ["allow", "deny"];

type PermissionRule = {
  role: string;
  resource: string;
  action: string;
  fields?: string[];
  effect?: string;
};

type ApprovalList = Awaited<ReturnType<typeof apiClient.listApprovals>>;
type ApprovalRequest = ApprovalList["requests"][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getMetadataString = (
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
};

const isPermissionRule = (value: unknown): value is PermissionRule =>
  isRecord(value) &&
  typeof value.role === "string" &&
  typeof value.resource === "string" &&
  typeof value.action === "string";

export default function PermissionsPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    role: "manager",
    resource: "audit",
    action: "export",
    fields: "",
    effect: "allow",
  });
  const [approvalForm, setApprovalForm] = useState({
    action: "export_pii",
    resource: "audit",
    targetId: "",
    justification: "",
  });
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const policiesQuery = useQuery({
    queryKey: ["permission-policies", campgroundId],
    queryFn: () => apiClient.getPermissionPolicies(campgroundId ?? undefined),
    enabled: true,
  });

  const approvalsQuery = useQuery<ApprovalList>({
    queryKey: ["approvals", campgroundId],
    queryFn: () => apiClient.listApprovals(),
    enabled: true,
  });

  const policyRules = useMemo(() => {
    const data = policiesQuery.data;
    if (!isRecord(data)) return [];
    const rules = data.rules;
    if (!Array.isArray(rules)) return [];
    return rules.filter(isPermissionRule);
  }, [policiesQuery.data]);

  const upsertRule = useMutation({
    mutationFn: () =>
      apiClient.upsertPermissionRule({
        campgroundId: campgroundId ?? undefined,
        role: ruleForm.role,
        resource: ruleForm.resource,
        action: ruleForm.action,
        effect: ruleForm.effect,
        fields: ruleForm.fields
          ? ruleForm.fields
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean)
          : [],
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permission-policies", campgroundId] }),
  });

  const submitApproval = useMutation({
    mutationFn: () =>
      apiClient.submitApproval({
        action: approvalForm.action,
        resource: approvalForm.resource,
        targetId: approvalForm.targetId || undefined,
        justification: approvalForm.justification || undefined,
        requestedBy: "current-user",
        campgroundId: campgroundId ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", campgroundId] }),
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Settings" }, { label: "Permissions" }]} />

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Role & permission rules</div>
            <div className="text-sm text-muted-foreground">Scoped RBAC with field-level rules.</div>
          </div>
          <Button size="sm" onClick={() => upsertRule.mutate()} disabled={upsertRule.isPending}>
            {upsertRule.isPending ? "Saving..." : "Save rule"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-sm">Role</Label>
            <Select
              value={ruleForm.role}
              onValueChange={(v) => setRuleForm((f) => ({ ...f, role: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Resource</Label>
            <Input
              value={ruleForm.resource}
              onChange={(e) => setRuleForm((f) => ({ ...f, resource: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Action</Label>
            <Input
              value={ruleForm.action}
              onChange={(e) => setRuleForm((f) => ({ ...f, action: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Fields (comma separated)</Label>
            <Input
              value={ruleForm.fields}
              onChange={(e) => setRuleForm((f) => ({ ...f, fields: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Effect</Label>
            <Select
              value={ruleForm.effect}
              onValueChange={(v) => setRuleForm((f) => ({ ...f, effect: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Effect" />
              </SelectTrigger>
              <SelectContent>
                {effects.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="py-2">Role</th>
                <th className="py-2">Resource</th>
                <th className="py-2">Action</th>
                <th className="py-2">Fields</th>
                <th className="py-2">Effect</th>
              </tr>
            </thead>
            <tbody>
              {policyRules.map((rule) => (
                <tr
                  key={`${rule.role}-${rule.resource}-${rule.action}`}
                  className="border-b last:border-b-0"
                >
                  <td className="py-2">{rule.role}</td>
                  <td className="py-2">{rule.resource}</td>
                  <td className="py-2">{rule.action}</td>
                  <td className="py-2">{(rule.fields || []).join(", ") || "—"}</td>
                  <td className="py-2 uppercase text-xs">{rule.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Approval workflows</div>
            <div className="text-sm text-muted-foreground">
              Require approval for sensitive actions.
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => submitApproval.mutate()}
            disabled={submitApproval.isPending}
          >
            {submitApproval.isPending ? "Submitting..." : "Submit approval request"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-sm">Action</Label>
            <Input
              value={approvalForm.action}
              onChange={(e) => setApprovalForm((f) => ({ ...f, action: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Resource</Label>
            <Input
              value={approvalForm.resource}
              onChange={(e) => setApprovalForm((f) => ({ ...f, resource: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Target ID</Label>
            <Input
              value={approvalForm.targetId}
              onChange={(e) => setApprovalForm((f) => ({ ...f, targetId: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Justification</Label>
            <Input
              value={approvalForm.justification}
              onChange={(e) => setApprovalForm((f) => ({ ...f, justification: e.target.value }))}
            />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="py-2">Action</th>
                <th className="py-2">Resource</th>
                <th className="py-2">Status</th>
                <th className="py-2">Requested</th>
              </tr>
            </thead>
            <tbody>
              {(approvalsQuery.data?.requests ?? []).map((a: ApprovalRequest) => {
                const metadata = isRecord(a.metadata) ? a.metadata : undefined;
                const action = getMetadataString(metadata, "action") ?? "—";
                const resource = getMetadataString(metadata, "resource") ?? "—";
                return (
                  <tr key={a.id} className="border-b last:border-b-0">
                    <td className="py-2">{action}</td>
                    <td className="py-2">{resource}</td>
                    <td className="py-2 uppercase text-xs">{a.status}</td>
                    <td className="py-2">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
