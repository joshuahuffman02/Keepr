"use client";

import { useState } from "react";
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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  lastActive: string;
  isActive: boolean;
}

const mockUsers: User[] = [
  {
    id: "1",
    name: "Josh Smith",
    email: "josh@campground.com",
    role: "Owner",
    lastActive: "2025-12-26T10:30:00",
    isActive: true,
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah@campground.com",
    role: "Manager",
    lastActive: "2025-12-26T09:15:00",
    isActive: true,
  },
  {
    id: "3",
    name: "Mike Williams",
    email: "mike@campground.com",
    role: "Front Desk",
    lastActive: "2025-12-25T16:45:00",
    isActive: true,
  },
  {
    id: "4",
    name: "Emily Davis",
    email: "emily@campground.com",
    role: "Front Desk",
    lastActive: "2025-12-24T11:20:00",
    isActive: true,
  },
  {
    id: "5",
    name: "Tom Brown",
    email: "tom@campground.com",
    role: "Maintenance",
    lastActive: "2025-12-20T14:30:00",
    isActive: false,
  },
];

const roleColors: Record<string, string> = {
  Owner: "bg-purple-100 text-purple-800",
  Manager: "bg-blue-100 text-blue-800",
  "Front Desk": "bg-emerald-100 text-emerald-800",
  Maintenance: "bg-amber-100 text-amber-800",
};

export default function UsersPage() {
  const [users] = useState<User[]>(mockUsers);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const formatLastActive = (date: string) => {
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
            <AvatarFallback className="bg-slate-100 text-slate-600 text-sm">
              {getInitials(item.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-slate-900">{item.name}</p>
            <p className="text-sm text-slate-500">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (item: User) => (
        <Badge className={roleColors[item.role] || "bg-slate-100 text-slate-800"}>
          {item.role}
        </Badge>
      ),
    },
    {
      key: "lastActive",
      label: "Last Active",
      render: (item: User) => (
        <span className="text-sm text-slate-500">
          {formatLastActive(item.lastActive)}
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
            item.isActive
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          )}
        >
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users</h2>
          <p className="text-slate-500 mt-1">
            Manage staff accounts and access permissions
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Users are assigned roles that control their access level. Configure roles
          in the Roles section to customize permissions.
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
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail className="h-4 w-4 mr-2" />
                Resend Invite
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Shield className="h-4 w-4 mr-2" />
                Change Role
              </DropdownMenuItem>
              <DropdownMenuItem>
                {item.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
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
