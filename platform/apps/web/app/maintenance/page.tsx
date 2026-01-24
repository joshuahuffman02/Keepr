"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { PageHeader } from "@/components/ui/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ClipboardList,
  MessageSquare,
  HeartPulse,
  ClipboardCheck,
  Play,
  CheckCircle,
  RotateCcw,
  StickyNote,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Maintenance } from "@keepr/shared";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTicketDialog, MaintenanceTicket } from "@/components/maintenance/CreateTicketDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpAnchor } from "@/components/help/HelpAnchor";
import { MobileQuickActionsBar } from "@/components/staff/MobileQuickActionsBar";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type MaintenanceStatus = Maintenance["status"];
type MaintenancePriority = Maintenance["priority"];
type MaintenanceRecord = Maintenance & {
  outOfOrder?: boolean | null;
  outOfOrderReason?: string | null;
};

const isMaintenanceStatus = (value: string): value is MaintenanceStatus =>
  value === "open" || value === "in_progress" || value === "closed";

const toMaintenanceTicket = (ticket: MaintenanceRecord): MaintenanceTicket => ({
  id: ticket.id,
  title: ticket.title,
  description: ticket.description ?? undefined,
  priority: ticket.priority,
  status: ticket.status,
  siteId: ticket.siteId ?? undefined,
  isBlocking: ticket.isBlocking ?? false,
  outOfOrder: ticket.outOfOrder ?? false,
  outOfOrderReason: ticket.outOfOrderReason ?? undefined,
  dueDate: ticket.dueDate ?? undefined,
  campgroundId: ticket.campgroundId,
});

export default function MaintenancePage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("open");
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [noteTicketId, setNoteTicketId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, [activeTab]);

  async function updateTicketStatus(ticketId: string, newStatus: MaintenanceStatus, note?: string) {
    setUpdatingTicket(ticketId);
    try {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;

      const payload: Record<string, unknown> = { status: newStatus };
      if (note) {
        // Append note to description
        payload.description = ticket.description
          ? `${ticket.description}\n\n[${format(new Date(), "MMM d, h:mm a")}] ${note}`
          : `[${format(new Date(), "MMM d, h:mm a")}] ${note}`;
      }

      await apiClient.updateMaintenance(ticketId, payload);
      toast({
        title: "Ticket updated",
        description: `Status changed to ${newStatus.replace("_", " ")}`,
      });
      loadTickets();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update ticket",
        variant: "destructive",
      });
    } finally {
      setUpdatingTicket(null);
    }
  }

  async function addNote(ticketId: string) {
    if (!noteText.trim()) return;

    setUpdatingTicket(ticketId);
    try {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;

      const newDescription = ticket.description
        ? `${ticket.description}\n\n[${format(new Date(), "MMM d, h:mm a")}] ${noteText}`
        : `[${format(new Date(), "MMM d, h:mm a")}] ${noteText}`;

      await apiClient.updateMaintenance(ticketId, { description: newDescription });
      toast({
        title: "Note added",
        description: "Your note has been saved to the ticket",
      });
      setNoteText("");
      setNoteTicketId(null);
      loadTickets();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setUpdatingTicket(null);
    }
  }

  async function loadTickets() {
    setLoading(true);
    try {
      // Fetch all tickets for now, filtering can be done client-side or via API params
      // Assuming apiClient has getMaintenanceTickets method (we need to add it)
      const status =
        activeTab === "all" ? undefined : isMaintenanceStatus(activeTab) ? activeTab : undefined;
      const data = await apiClient.getMaintenanceTickets(status);
      setTickets(data);
    } catch (error) {
      console.error("Failed to load tickets", error);
    } finally {
      setLoading(false);
    }
  }

  const getPriorityColor = (priority: MaintenancePriority) => {
    switch (priority) {
      case "critical":
        return "bg-status-error-bg text-status-error-text border-status-error-border";
      case "high":
        return "bg-status-warning-bg text-status-warning-text border-status-warning-border";
      case "medium":
        return "bg-status-warning-bg text-status-warning-text border-status-warning-border";
      case "low":
        return "bg-status-info-bg text-status-info-text border-status-info-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case "open":
        return "bg-status-info-bg text-status-info-text";
      case "in_progress":
        return "bg-status-warning-bg text-status-warning-text";
      case "closed":
        return "bg-status-success-bg text-status-success-text";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Operations"
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-warning/15 text-status-warning">
                <ClipboardList className="h-5 w-5" />
              </span>
              <span>Maintenance</span>
            </span>
          }
          subtitle="Track repairs, work orders, and site maintenance without losing momentum."
          actions={
            <>
              <HelpAnchor topicId="maintenance-work-orders" label="Maintenance help" />
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Open"
            value={tickets.filter((t) => t.status === "open").length}
            icon={<ClipboardList className="h-4 w-4" />}
            highlight={activeTab === "open"}
            onClick={() => setActiveTab("open")}
          />
          <SummaryCard
            label="In progress"
            value={tickets.filter((t) => t.status === "in_progress").length}
            icon={<Play className="h-4 w-4" />}
            highlight={activeTab === "in_progress"}
            onClick={() => setActiveTab("in_progress")}
          />
          <SummaryCard
            label="Closed"
            value={tickets.filter((t) => t.status === "closed").length}
            icon={<CheckCircle className="h-4 w-4" />}
            highlight={activeTab === "closed"}
            onClick={() => setActiveTab("closed")}
          />
          <SummaryCard
            label="All tickets"
            value={tickets.length}
            icon={<ClipboardCheck className="h-4 w-4" />}
            highlight={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          />
        </div>
      </div>

      <Tabs
        value={activeTab}
        defaultValue="open"
        onValueChange={setActiveTab}
        className="w-full pb-24 md:pb-10"
        id="maintenance-list"
      >
        <TabsList className="mb-4 w-full overflow-x-auto rounded-xl p-1">
          <TabsTrigger value="open" className="flex-1 min-w-[120px]">
            Open
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="flex-1 min-w-[120px]">
            In Progress
          </TabsTrigger>
          <TabsTrigger value="closed" className="flex-1 min-w-[120px]">
            Closed
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1 min-w-[120px]">
            All Tickets
          </TabsTrigger>
        </TabsList>

        <div className="grid gap-4">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 border rounded-lg bg-muted">
              <p className="text-muted-foreground">No tickets found.</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} className="relative overflow-hidden">
                <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div
                    className={`hidden sm:block w-2 h-full absolute left-0 top-0 ${
                      ticket.priority === "critical"
                        ? "bg-status-error"
                        : ticket.priority === "high"
                          ? "bg-status-warning"
                          : "bg-transparent"
                    }`}
                  />

                  <div className="flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{ticket.title}</h3>
                        <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        {ticket.isBlocking && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            Blocking
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className={getStatusColor(ticket.status)}>
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground text-sm mb-3 whitespace-pre-wrap">
                      {ticket.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="rounded-full border border-border bg-muted px-2 py-1">
                        Created {format(new Date(ticket.createdAt || new Date()), "MMM d, yyyy")}
                      </span>
                      {ticket.siteId && (
                        <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded border border-border">
                          Site: {ticket.siteId}
                        </span>
                      )}
                      {ticket.dueDate && (
                        <span className="rounded-full border border-status-warning/20 bg-status-warning/10 px-2 py-1 text-status-warning">
                          Due: {format(new Date(ticket.dueDate), "MMM d")}
                        </span>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                      {ticket.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-status-info border-status-info/20 hover:bg-status-info/10"
                          disabled={updatingTicket === ticket.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTicketStatus(ticket.id, "in_progress");
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start Work
                        </Button>
                      )}
                      {ticket.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-status-success border-status-success/20 hover:bg-status-success/10"
                          disabled={updatingTicket === ticket.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTicketStatus(ticket.id, "closed");
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Button>
                      )}
                      {ticket.status === "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground border-border hover:bg-muted"
                          disabled={updatingTicket === ticket.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTicketStatus(ticket.id, "open");
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reopen
                        </Button>
                      )}

                      <Popover
                        open={noteTicketId === ticket.id}
                        onOpenChange={(open) => {
                          if (open) {
                            setNoteTicketId(ticket.id);
                            setNoteText("");
                          } else {
                            setNoteTicketId(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <StickyNote className="h-3 w-3 mr-1" />
                            Add Note
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-3">
                            <Label htmlFor={`note-${ticket.id}`}>Add a note</Label>
                            <Textarea
                              id={`note-${ticket.id}`}
                              placeholder="Enter your note..."
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              rows={3}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setNoteTicketId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={!noteText.trim() || updatingTicket === ticket.id}
                                onClick={() => addNote(ticket.id)}
                              >
                                Save Note
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicket(toMaintenanceTicket(ticket));
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Tabs>

      <CreateTicketDialog
        open={isCreateOpen || !!selectedTicket}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setSelectedTicket(null);
          } else {
            setIsCreateOpen(true);
          }
        }}
        onSuccess={() => {
          setIsCreateOpen(false);
          setSelectedTicket(null);
          loadTickets();
        }}
        ticket={selectedTicket}
      />
      <MobileQuickActionsBar
        active="tasks"
        items={[
          {
            key: "tasks",
            label: "Tasks",
            href: "#maintenance-list",
            icon: <ClipboardList className="h-4 w-4" />,
            badge: tickets.filter((t) => t.status !== "closed").length,
          },
          {
            key: "messages",
            label: "Messages",
            href: "/messages",
            icon: <MessageSquare className="h-4 w-4" />,
          },
          {
            key: "checklists",
            label: "Checklists",
            href: "/operations#checklists",
            icon: <ClipboardCheck className="h-4 w-4" />,
          },
          {
            key: "ops-health",
            label: "Ops health",
            href: "/operations#ops-health",
            icon: <HeartPulse className="h-4 w-4" />,
          },
        ]}
      />
    </DashboardShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  highlight,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(highlight)}
      className={cn(
        "group w-full text-left rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-warning focus-visible:ring-offset-2",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all",
          "group-hover:-translate-y-0.5 group-hover:shadow-md",
          highlight
            ? "border-status-warning/30 bg-status-warning/10"
            : "border-border bg-card group-hover:border-muted-foreground/30",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-lg p-2",
              highlight
                ? "bg-status-warning/20 text-status-warning"
                : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </span>
          <div>
            <div
              className={cn(
                "text-xs font-semibold tracking-wide",
                highlight ? "text-status-warning" : "text-muted-foreground",
              )}
            >
              {label}
            </div>
            <div
              className={cn(
                "text-xl font-bold",
                highlight ? "text-status-warning" : "text-foreground",
              )}
            >
              {value}
            </div>
          </div>
        </div>
        <ArrowRight
          className={cn("h-4 w-4", highlight ? "text-status-warning" : "text-muted-foreground")}
        />
      </div>
    </button>
  );
}
