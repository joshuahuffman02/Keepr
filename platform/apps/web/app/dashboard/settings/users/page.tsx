"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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

// Form types
type InviteMemberFormData = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: Role;
};

type OnboardingInviteFormData = {
  email: string;
  expiresInHours: number;
};

// Email validation helper
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [onboardingLink, setOnboardingLink] = useState<string | null>(null);

  // Form for inviting members
  const inviteForm = useForm<InviteMemberFormData>({
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "manager",
    },
    mode: "onChange",
  });

  // Form for onboarding invites
  const onboardingForm = useForm<OnboardingInviteFormData>({
    defaultValues: {
      email: "",
      expiresInHours: 72,
    },
    mode: "onChange",
  });

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
    mutationFn: async (data: InviteMemberFormData) => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.addCampgroundMember(campgroundId, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground-members", campgroundId] });
      inviteForm.reset();
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
    mutationFn: async (data: OnboardingInviteFormData) => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.createOnboardingInvite({
        email: data.email,
        campgroundId,
        expiresInHours: data.expiresInHours,
      });
    },
    onSuccess: (res) => {
      const base =
        typeof window !== "undefined"
          ? `${window.location.origin}`
          : process.env.NEXT_PUBLIC_APP_URL || "https://app.campreserv.com";
      const link = `${base}/onboarding/${res.token}`;
      setOnboardingLink(link);
      onboardingForm.reset({ email: "", expiresInHours: 72 });
      toast({ title: "Onboarding invite sent", description: "Share the link with the new campground contact." });
    },
    onError: (err: Error) => toast({ title: "Failed to send onboarding invite", description: err.message, variant: "destructive" })
  });

  return (
    <div>
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
          <CardContent>
            <form onSubmit={inviteForm.handleSubmit((data) => addMember.mutate(data))} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  label="Email"
                  type="email"
                  placeholder="staff@example.com"
                  error={inviteForm.formState.errors.email?.message}
                  showSuccess
                  {...inviteForm.register("email")}
                />
                <FormField
                  label="First name (optional)"
                  placeholder="Pat"
                  error={inviteForm.formState.errors.firstName?.message}
                  {...inviteForm.register("firstName")}
                />
                <FormField
                  label="Last name (optional)"
                  placeholder="Smith"
                  error={inviteForm.formState.errors.lastName?.message}
                  {...inviteForm.register("lastName")}
                />
              </div>
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
                <div className="space-y-2 w-full md:w-64">
                  <Label>Role</Label>
                  <Select
                    value={inviteForm.watch("role")}
                    onValueChange={(val) => inviteForm.setValue("role", val as Role, { shouldValidate: true })}
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
                  type="submit"
                  disabled={!inviteForm.formState.isValid || addMember.isPending}
                >
                  {addMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add member
                </Button>
              </div>
            </form>
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
          <CardContent>
            <form onSubmit={onboardingForm.handleSubmit((data) => createOnboardingInvite.mutate(data))} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  label="Recipient email"
                  type="email"
                  placeholder="owner@camp.com"
                  error={onboardingForm.formState.errors.email?.message}
                  showSuccess
                  {...onboardingForm.register("email")}
                />
                <FormField
                  label="Expires in (hours)"
                  type="number"
                  min={1}
                  max={168}
                  error={onboardingForm.formState.errors.expiresInHours?.message}
                  showSuccess
                  {...onboardingForm.register("expiresInHours", { valueAsNumber: true })}
                />
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={!onboardingForm.formState.isValid || createOnboardingInvite.isPending}
                    className="w-full md:w-auto"
                  >
                    {createOnboardingInvite.isPending ? "Sending..." : "Send onboarding invite"}
                  </Button>
                </div>
              </div>
              {onboardingLink && (
                <div className="space-y-2">
                  <Label>Onboarding link</Label>
                  <input
                    type="text"
                    value={onboardingLink}
                    readOnly
                    onFocus={(e) => e.target.select()}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Share this link with the campground to start setup. A new resend generates a fresh link.</p>
                </div>
              )}
            </form>
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
    </div>
  );
}
