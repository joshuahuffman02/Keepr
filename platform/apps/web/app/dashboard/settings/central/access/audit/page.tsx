"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Search,
  Download,
  User,
  Calendar,
  Edit,
  Plus,
  Trash2,
  LogIn,
  Settings,
  CreditCard,
} from "lucide-react";

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  actionType: "create" | "update" | "delete" | "login" | "setting" | "payment";
  resource: string;
  resourceId: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}

const mockAuditLog: AuditEntry[] = [
  {
    id: "1",
    userId: "1",
    userName: "Josh Smith",
    action: "Updated reservation",
    actionType: "update",
    resource: "Reservation",
    resourceId: "R-1234",
    details: "Changed check-out date from Dec 28 to Dec 30",
    timestamp: "2025-12-26T10:30:00",
    ipAddress: "192.168.1.1",
  },
  {
    id: "2",
    userId: "2",
    userName: "Sarah Johnson",
    action: "Processed payment",
    actionType: "payment",
    resource: "Payment",
    resourceId: "P-5678",
    details: "Collected $245.00 for reservation R-1234",
    timestamp: "2025-12-26T10:15:00",
    ipAddress: "192.168.1.2",
  },
  {
    id: "3",
    userId: "1",
    userName: "Josh Smith",
    action: "Created rate group",
    actionType: "create",
    resource: "Rate Group",
    resourceId: "RG-001",
    details: "Created 'Peak Summer' rate group",
    timestamp: "2025-12-26T09:45:00",
    ipAddress: "192.168.1.1",
  },
  {
    id: "4",
    userId: "3",
    userName: "Mike Williams",
    action: "Logged in",
    actionType: "login",
    resource: "Session",
    resourceId: "S-9012",
    details: "Successful login from Chrome on macOS",
    timestamp: "2025-12-26T08:00:00",
    ipAddress: "192.168.1.3",
  },
  {
    id: "5",
    userId: "1",
    userName: "Josh Smith",
    action: "Updated settings",
    actionType: "setting",
    resource: "Booking Policy",
    resourceId: "BP-001",
    details: "Changed check-in time from 3 PM to 4 PM",
    timestamp: "2025-12-25T16:30:00",
    ipAddress: "192.168.1.1",
  },
  {
    id: "6",
    userId: "2",
    userName: "Sarah Johnson",
    action: "Cancelled reservation",
    actionType: "delete",
    resource: "Reservation",
    resourceId: "R-1122",
    details: "Guest requested cancellation, refund processed",
    timestamp: "2025-12-25T14:20:00",
    ipAddress: "192.168.1.2",
  },
];

const actionTypeConfig = {
  create: { icon: Plus, color: "text-emerald-600 bg-emerald-100" },
  update: { icon: Edit, color: "text-blue-600 bg-blue-100" },
  delete: { icon: Trash2, color: "text-red-600 bg-red-100" },
  login: { icon: LogIn, color: "text-purple-600 bg-purple-100" },
  setting: { icon: Settings, color: "text-amber-600 bg-amber-100" },
  payment: { icon: CreditCard, color: "text-emerald-600 bg-emerald-100" },
};

export default function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const filteredLog = mockAuditLog.filter((entry) => {
    const matchesSearch =
      entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || entry.actionType === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Audit Log</h2>
          <p className="text-slate-500 mt-1">
            Track all user actions and system changes
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Log
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by user, action, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="create">Created</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="delete">Deleted</SelectItem>
                <SelectItem value="login">Logins</SelectItem>
                <SelectItem value="setting">Settings</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <div className="space-y-2">
        {filteredLog.map((entry) => {
          const config = actionTypeConfig[entry.actionType];
          const Icon = config.icon;
          const { date, time } = formatTimestamp(entry.timestamp);

          return (
            <Card key={entry.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${config.color.split(" ")[1]}`}>
                    <Icon className={`h-4 w-4 ${config.color.split(" ")[0]}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">
                        {entry.action}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {entry.resource}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{entry.details}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-500 shrink-0">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-slate-100">
                          {getInitials(entry.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{entry.userName}</span>
                    </div>
                    <div className="text-right">
                      <p>{date}</p>
                      <p className="text-slate-400">{time}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredLog.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-slate-900">No matching entries</h3>
              <p className="text-sm text-slate-500 mt-1">
                Try adjusting your search or filter criteria
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
