"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Shield,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Lock,
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
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: string[];
  isSystem: boolean;
}

// System roles with their default permissions
const systemRoles: Omit<Role, "userCount">[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Full access to all features and settings",
    permissions: ["All permissions"],
    isSystem: true,
  },
  {
    id: "manager",
    name: "Manager",
    description: "Manage reservations, staff, and daily operations",
    permissions: ["Reservations", "Guests", "Reports", "Staff Management"],
    isSystem: true,
  },
  {
    id: "front_desk",
    name: "Front Desk",
    description: "Handle check-ins, check-outs, and guest inquiries",
    permissions: ["Reservations", "Guests", "POS"],
    isSystem: true,
  },
  {
    id: "maintenance",
    name: "Maintenance",
    description: "View and update site status and maintenance tasks",
    permissions: ["Site Status", "Work Orders"],
    isSystem: true,
  },
  {
    id: "finance",
    name: "Finance",
    description: "Access to financial reports and billing",
    permissions: ["Reports", "Billing", "Invoices"],
    isSystem: true,
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Manage promotions and marketing campaigns",
    permissions: ["Promotions", "Reports"],
    isSystem: true,
  },
  {
    id: "readonly",
    name: "Read Only",
    description: "View-only access to dashboards and reports",
    permissions: ["View Dashboard", "View Reports"],
    isSystem: true,
  },
];

type CampgroundMember = Awaited<ReturnType<typeof apiClient.getCampgroundMembers>>[number];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      // Still show roles without counts
      setRoles(systemRoles.map(r => ({ ...r, userCount: 0 })));
      setLoading(false);
      return;
    }

    // Fetch members to count users per role
    apiClient.getCampgroundMembers(id)
      .then((members: CampgroundMember[]) => {
        const roleCounts: Record<string, number> = {};
        members.forEach((member) => {
          roleCounts[member.role] = (roleCounts[member.role] || 0) + 1;
        });

        const rolesWithCounts: Role[] = systemRoles.map(r => ({
          ...r,
          userCount: roleCounts[r.id] || 0,
        }));

        setRoles(rolesWithCounts);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load members:", err);
        setRoles(systemRoles.map(r => ({ ...r, userCount: 0 })));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Roles</h2>
          <p className="text-muted-foreground mt-1">
            Define roles and their permissions for team members
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Roles</h2>
          <p className="text-muted-foreground mt-1">
            Define roles and their permissions for team members
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          System roles have predefined permissions that cover common campground staff needs.
          You can create custom roles for specific requirements.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {roles.map((role) => (
          <Card
            key={role.id}
            className="transition-all hover:shadow-md group"
          >
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className={cn(
                    "p-2 rounded-lg",
                    role.isSystem ? "bg-purple-100" : "bg-muted"
                  )}>
                    <Shield className={cn(
                      "h-5 w-5",
                      role.isSystem ? "text-purple-600" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{role.name}</h3>
                      {role.isSystem && (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          System
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {role.permissions.slice(0, 4).map((permission) => (
                        <Badge
                          key={permission}
                          variant="secondary"
                          className="text-xs"
                        >
                          {permission}
                        </Badge>
                      ))}
                      {role.permissions.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{role.permissions.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {role.userCount} user{role.userCount !== 1 && "s"}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="More options"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Permissions
                      </DropdownMenuItem>
                      {!role.isSystem && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Role
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
