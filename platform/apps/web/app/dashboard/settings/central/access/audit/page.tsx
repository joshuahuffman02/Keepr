"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Edit,
  Plus,
  Trash2,
  LogIn,
  Settings,
  CreditCard,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface AuditEntry {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  actionType: "create" | "update" | "delete" | "login" | "setting" | "payment";
  resource: string;
  resourceId: string | null;
  details: string;
  timestamp: string;
  ipAddress: string | null;
}

type AuditLogEntry = Awaited<ReturnType<typeof apiClient.getAuditLogs>>[number];

const actionTypeConfig = {
  create: { icon: Plus, color: "text-emerald-600 bg-emerald-100" },
  update: { icon: Edit, color: "text-blue-600 bg-blue-100" },
  delete: { icon: Trash2, color: "text-red-600 bg-red-100" },
  login: { icon: LogIn, color: "text-purple-600 bg-purple-100" },
  setting: { icon: Settings, color: "text-amber-600 bg-amber-100" },
  payment: { icon: CreditCard, color: "text-emerald-600 bg-emerald-100" },
};

function mapActionToType(
  action: string,
): "create" | "update" | "delete" | "login" | "setting" | "payment" {
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes("create") || lowerAction.includes("add")) return "create";
  if (
    lowerAction.includes("delete") ||
    lowerAction.includes("remove") ||
    lowerAction.includes("cancel")
  )
    return "delete";
  if (lowerAction.includes("login") || lowerAction.includes("auth")) return "login";
  if (
    lowerAction.includes("payment") ||
    lowerAction.includes("charge") ||
    lowerAction.includes("refund")
  )
    return "payment";
  if (lowerAction.includes("setting") || lowerAction.includes("config")) return "setting";
  return "update";
}

export default function AuditLogPage() {
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    apiClient
      .getAuditLogs(id, { limit: 100 })
      .then((entries) => {
        const mapped: AuditEntry[] = entries.map((entry: AuditLogEntry) => ({
          id: entry.id,
          userId: entry.actorId,
          userName: entry.actor
            ? `${entry.actor.firstName || ""} ${entry.actor.lastName || ""}`.trim() ||
              entry.actor.email
            : "System",
          action: entry.action,
          actionType: mapActionToType(entry.action),
          resource: entry.entity || "System",
          resourceId: entry.entityId,
          details: entry.action,
          timestamp: entry.createdAt,
          ipAddress: entry.ip,
        }));
        setAuditLog(mapped);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load audit log:", err);
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const filteredLog = auditLog.filter((entry) => {
    const matchesSearch =
      entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || entry.actionType === actionFilter;
    return matchesSearch && matchesAction;
  });

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audit Log</h2>
          <p className="text-muted-foreground mt-1">Track all user actions and system changes</p>
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
          <h2 className="text-2xl font-bold text-foreground">Audit Log</h2>
          <p className="text-muted-foreground mt-1">Track all user actions and system changes</p>
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
          <h2 className="text-2xl font-bold text-foreground">Audit Log</h2>
          <p className="text-muted-foreground mt-1">Track all user actions and system changes</p>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                      <span className="font-medium text-foreground">{entry.action}</span>
                      <Badge variant="outline" className="text-xs">
                        {entry.resource}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.details}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-muted">
                          {getInitials(entry.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{entry.userName}</span>
                    </div>
                    <div className="text-right">
                      <p>{date}</p>
                      <p className="text-muted-foreground">{time}</p>
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
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-foreground">No matching entries</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search or filter criteria
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
