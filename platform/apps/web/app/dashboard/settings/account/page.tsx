"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout/PageHeader";
import { useWhoami } from "@/hooks/use-whoami";
import { User, Shield, Users } from "lucide-react";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const { data: whoami } = useWhoami();

  const sessionUser = isRecord(session?.user) ? session.user : undefined;
  const whoamiUser = whoami?.user;
  const sessionName = getString(sessionUser?.name);
  const sessionEmail = getString(sessionUser?.email);
  const sessionFirstName = getString(sessionUser?.firstName);
  const sessionLastName = getString(sessionUser?.lastName);

  const displayName =
    [whoamiUser?.firstName, whoamiUser?.lastName].filter(Boolean).join(" ") ||
    sessionName ||
    [sessionFirstName, sessionLastName].filter(Boolean).join(" ") ||
    whoamiUser?.email ||
    sessionEmail ||
    "Signed in";

  const displayEmail = whoamiUser?.email || sessionEmail || "";
  const platformRole = whoamiUser?.platformRole || null;
  const memberships = whoamiUser?.memberships ?? [];
  const isAuthenticated = Boolean(displayEmail || displayName !== "Signed in");

  if (!isAuthenticated) {
    return (
      <>
        <PageHeader
          eyebrow="Account"
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <User className="h-5 w-5" />
              </span>
              <span>My Profile</span>
            </span>
          }
          subtitle="Sign in to view your profile and access details."
          actions={
            <Button asChild>
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          }
        />

        <div className="mt-6">
          <Card className="border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">
              You're currently signed out. Sign in to view your profile, team role, and campground
              access.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <User className="h-5 w-5" />
            </span>
            <span>My Profile</span>
          </span>
        }
        subtitle="Your sign-in details and access scope."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/security">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/settings/users">
                <Users className="h-4 w-4 mr-2" />
                Manage team
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Signed in as
              </div>
              <div className="text-2xl font-semibold text-foreground">{displayName}</div>
              {displayEmail && <div className="text-sm text-muted-foreground">{displayEmail}</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              {platformRole && (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  Platform: {platformRole}
                </Badge>
              )}
              {memberships.length === 0 && (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  No campground roles found
                </Badge>
              )}
            </div>
            <div className="border-t border-border pt-4">
              <div className="text-sm font-semibold text-foreground mb-2">Campground access</div>
              <div className="space-y-2">
                {memberships.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Access is managed by your administrator.
                  </div>
                ) : (
                  memberships.map((membership, index) => (
                    <div
                      key={`${membership.campgroundId ?? "camp"}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-foreground">
                        {membership.campground?.name ?? "Campground"}
                      </div>
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        {membership.role ?? "Member"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="text-sm font-semibold text-foreground">Account tips</div>
              <p className="text-sm text-muted-foreground mt-1">
                Need to update your name, permissions, or sign-in method? Your admin can help from
                the team settings page. Security settings are available in the menu above.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              If your access looks wrong, sign out and back in or ask an owner to refresh your role.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
