"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Users,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Shield,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsTable } from "@/components/settings/tables";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  lastActive: string | null;
  isActive: boolean;
  isPending: boolean;
}

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  manager: "bg-status-info/15 text-status-info",
  front_desk: "bg-status-success/15 text-status-success",
  maintenance: "bg-status-warning/15 text-status-warning",
  finance: "bg-cyan-100 text-cyan-800",
  marketing: "bg-pink-100 text-pink-800",
  readonly: "bg-muted text-foreground",
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  front_desk: "Front Desk",
  maintenance: "Maintenance",
  finance: "Finance",
  marketing: "Marketing",
  readonly: "Read Only",
};

type CampgroundMember = Awaited<ReturnType<typeof apiClient.getCampgroundMembers>>[number];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    apiClient
      .getCampgroundMembers(id)
      .then((members: CampgroundMember[]) => {
        const mappedUsers: User[] = members.map((member) => ({
          id: member.id,
          name: member.user
            ? `${member.user.firstName || ""} ${member.user.lastName || ""}`.trim() ||
              member.user.email
            : "Pending",
          email: member.user?.email || "",
          role: member.role,
          lastActive: member.lastInviteRedeemedAt || member.createdAt,
          isActive: !member.inviteExpiresAt || new Date(member.inviteExpiresAt) > new Date(),
          isPending: !!member.inviteExpiresAt && !member.lastInviteRedeemedAt,
        }));
        setUsers(mappedUsers);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load users:", err);
        setLoading(false);
      });
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastActive = (date: string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  const columns = [
    {
      key: "name",
      label: "User",
      render: (item: User) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={item.avatar} />
            <AvatarFallback className="bg-muted text-muted-foreground text-sm">
              {getInitials(item.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <p className="text-sm text-muted-foreground">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (item: User) => (
        <Badge className={roleColors[item.role] || "bg-muted text-foreground"}>
          {roleLabels[item.role] || item.role}
        </Badge>
      ),
    },
    {
      key: "lastActive",
      label: "Last Active",
      render: (item: User) => (
        <span className="text-sm text-muted-foreground">
          {item.isPending ? "Invite pending" : formatLastActive(item.lastActive)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: User) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className={cn(
            item.isPending
              ? "bg-status-warning/15 text-status-warning"
              : item.isActive
                ? "bg-status-success/15 text-status-success"
                : "bg-muted text-muted-foreground",
          )}
        >
          {item.isPending ? "Pending" : item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Users</h2>
          <p className="text-muted-foreground mt-1">Manage staff accounts and access permissions</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Users</h2>
          <p className="text-muted-foreground mt-1">Manage staff accounts and access permissions</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Users</h2>
          <p className="text-muted-foreground mt-1">Manage staff accounts and access permissions</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Users are assigned roles that control their access level. Configure roles in the Roles
          section to customize permissions.
        </AlertDescription>
      </Alert>

      <SettingsTable
        data={users}
        columns={columns}
        searchPlaceholder="Search users..."
        searchFields={["name", "email", "role"]}
        addLabel="Invite User"
        onAdd={() => {}}
        getItemStatus={(item) => (item.isActive ? "active" : "inactive")}
        getRowActions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {item.isPending && (
                <DropdownMenuItem>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Invite
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Shield className="h-4 w-4 mr-2" />
                Change Role
              </DropdownMenuItem>
              <DropdownMenuItem>{item.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyState={{
          icon: Users,
          title: "No users",
          description: "Invite team members to help manage your campground",
        }}
      />
    </div>
  );
}
