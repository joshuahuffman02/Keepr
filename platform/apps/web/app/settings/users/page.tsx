"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { Loader2, Shield, Trash2, Users } from "lucide-react";
import { HelpAnchor } from "@/components/help/HelpAnchor";

type Role = "owner" | "manager" | "front_desk" | "maintenance" | "finance" | "marketing" | "readonly";

type Member = {
  id: string;
  role: Role;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    isActive?: boolean;
  };
  lastInviteSentAt: string | null;
  lastInviteRedeemedAt: string | null;
  inviteExpiresAt: string | null;
};

const roleLabels: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  front_desk: "Front Desk",
  maintenance: "Maintenance",
  finance: "Finance",
  marketing: "Marketing",
  readonly: "Read-only"
};

export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [invite, setInvite] = useState({ email: "", firstName: "", lastName: "", role: "manager" as Role });
  const [onboardingEmail, setOnboardingEmail] = useState("");
  const [onboardingExpiresHours, setOnboardingExpiresHours] = useState(72);
  const [onboardingLink, setOnboardingLink] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const membersQuery = useQuery({
    queryKey: ["campground-members", campgroundId],
    queryFn: () => apiClient.getCampgroundMembers(campgroundId!),
    enabled: !!campgroundId
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.addCampgroundMember(campgroundId, invite);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground-members", campgroundId] });
      setInvite({ email: "", firstName: "", lastName: "", role: "manager" });
      toast({ title: "Member added", description: "User invited/added to this campground." });
    },
    onError: (err: Error) => toast({ title: "Failed to add member", description: err.message, variant: "destructive" })
  });

  const updateRole = useMutation({
    mutationFn: async (vars: { membershipId: string; role: Role }) => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.updateCampgroundMemberRole(campgroundId, vars.membershipId, vars.role);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground-members", campgroundId] });
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update role", description: err.message, variant: "destructive" })
  });

  const removeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.removeCampgroundMember(campgroundId, membershipId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground-members", campgroundId] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => toast({ title: "Failed to remove member", description: err.message, variant: "destructive" })
  });

  const memberCount = useMemo(() => membersQuery.data?.length ?? 0, [membersQuery.data]);

  const resendInvite = useMutation({
    mutationFn: async (membershipId: string) => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.resendCampgroundInvite(campgroundId, membershipId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground-members", campgroundId] });
      toast({ title: "Invite resent" });
    },
    onError: (err: Error) => toast({ title: "Failed to resend invite", description: err.message, variant: "destructive" })
  });

  const createOnboardingInvite = useMutation({
    mutationFn: async () => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.createOnboardingInvite({
        email: onboardingEmail,
        campgroundId,
        expiresInHours: onboardingExpiresHours || undefined,
      });
    },
    onSuccess: (res) => {
      const base =
        typeof window !== "undefined"
          ? `${window.location.origin}`
          : process.env.NEXT_PUBLIC_APP_URL || "https://app.campreserv.com";
      const link = `${base}/onboarding/${res.token}`;
      setOnboardingLink(link);
      setOnboardingEmail("");
      toast({ title: "Onboarding invite sent", description: "Share the link with the new campground contact." });
    },
    onError: (err: Error) => toast({ title: "Failed to send onboarding invite", description: err.message, variant: "destructive" })
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Users & roles</h1>
              <HelpAnchor topicId="roles-permissions" label="Roles & permissions help" />
            </div>
            <p className="text-muted-foreground">Manage staff access for this campground.</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Users className="h-4 w-4" />
            {memberCount} members
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Invite or add a member
            </CardTitle>
            <CardDescription>Creates the user if the email is new, then assigns the role for this campground.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={invite.email}
                  onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
                  placeholder="staff@example.com"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <Label>First name (optional)</Label>
                <Input
                  value={invite.firstName}
                  onChange={(e) => setInvite((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Pat"
                />
              </div>
              <div className="space-y-2">
                <Label>Last name (optional)</Label>
                <Input
                  value={invite.lastName}
                  onChange={(e) => setInvite((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="space-y-2 w-full md:w-64">
                <Label>Role</Label>
                <Select
                  value={invite.role}
                  onValueChange={(val) => setInvite((p) => ({ ...p, role: val as Role }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => addMember.mutate()}
                disabled={!invite.email || addMember.isPending}
              >
                {addMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add member
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Onboarding invite (campground setup)
            </CardTitle>
            <CardDescription>Send the guided onboarding link to the campground owner/manager.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Recipient email</Label>
                <Input
                  value={onboardingEmail}
                  onChange={(e) => setOnboardingEmail(e.target.value)}
                  placeholder="owner@camp.com"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <Label>Expires in (hours)</Label>
                <Input
                  type="number"
                  value={onboardingExpiresHours}
                  min={1}
                  onChange={(e) => setOnboardingExpiresHours(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => createOnboardingInvite.mutate()}
                  disabled={!onboardingEmail || createOnboardingInvite.isPending}
                  className="w-full md:w-auto"
                >
                  {createOnboardingInvite.isPending ? "Sending..." : "Send onboarding invite"}
                </Button>
              </div>
            </div>
            {onboardingLink && (
              <div className="space-y-2">
                <Label>Onboarding link</Label>
                <Input value={onboardingLink} readOnly onFocus={(e) => e.target.select()} />
                <p className="text-xs text-muted-foreground">Share this link with the campground to start setup. A new resend generates a fresh link.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team members</CardTitle>
            <CardDescription>Change roles or remove access for this campground.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {membersQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members...
              </div>
            ) : !membersQuery.data || membersQuery.data.length === 0 ? (
              <div className="text-sm text-muted-foreground">No members yet. Invite your first teammate above.</div>
            ) : (
              <div className="space-y-3">
                {(membersQuery.data as Member[]).map((member) => {
                  const invitePending = !!member.lastInviteSentAt && !member.lastInviteRedeemedAt;
                  return (
                    <div key={member.id} className="flex flex-col md:flex-row md:items-center justify-between rounded-lg border px-4 py-3 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.user.firstName} {member.user.lastName}</span>
                          <Badge variant="secondary">{roleLabels[member.role as Role] || member.role}</Badge>
                          {!member.user.isActive && (
                            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Inactive</Badge>
                          )}
                          {invitePending && (
                            <Badge variant="outline" className="text-sky-700 border-sky-200 bg-sky-50">Invite pending</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{member.user.email}</div>
                        {invitePending && member.lastInviteSentAt && (
                          <div className="text-xs text-slate-500">
                            Sent {new Date(member.lastInviteSentAt).toLocaleDateString()} {member.inviteExpiresAt ? `(expires ${new Date(member.inviteExpiresAt).toLocaleDateString()})` : ""}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Select
                          value={member.role}
                          onValueChange={(val) => updateRole.mutate({ membershipId: member.id, role: val as Role })}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {invitePending && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => resendInvite.mutate(member.id)}
                            disabled={resendInvite.isPending}
                          >
                            {resendInvite.isPending ? "Resending..." : "Resend invite"}
                          </Button>
                        )}
                        <Separator orientation="vertical" className="hidden md:block h-6" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => removeMember.mutate(member.id)}
                          disabled={removeMember.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
