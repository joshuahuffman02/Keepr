"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";

function InvitePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [token, setToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setToken(searchParams.get("token"));
  }, [searchParams]);

  const accept = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Missing invite token");
      if (!firstName.trim() || !lastName.trim()) throw new Error("Name is required");
      if (password.length < 8) throw new Error("Password must be at least 8 characters");
      if (password !== confirmPassword) throw new Error("Passwords do not match");
      return apiClient.acceptInvite({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });
    },
    onSuccess: () => {
      toast({ title: "Invite accepted", description: "You can now sign in." });
      router.push("/auth/signin");
    },
    onError: (err: Error) => {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    },
  });

  if (!token) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64 text-sm text-slate-600">
          Missing invite token.
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Accept your invite</CardTitle>
            <CardDescription>Set your name and password to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-slate-500">Minimum 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label>Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
              {accept.isPending ? "Accepting..." : "Accept invite"}
            </Button>
            <p className="text-xs text-slate-500 text-center">Invite token: {token.slice(0, 6)}…</p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading invite…</div>}>
      <InvitePageInner />
    </Suspense>
  );
}
