"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Plus, Filter, ClipboardList, MessageSquare, HeartPulse, ClipboardCheck } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Maintenance } from "@campreserv/shared";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTicketDialog, MaintenanceTicket } from "@/components/maintenance/CreateTicketDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpAnchor } from "@/components/help/HelpAnchor";
import { MobileQuickActionsBar } from "@/components/staff/MobileQuickActionsBar";

type MaintenanceStatus = Maintenance["status"];
type MaintenancePriority = Maintenance["priority"];

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("open");
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);

  useEffect(() => {
    loadTickets();
  }, [activeTab]);

  async function loadTickets() {
    setLoading(true);
    try {
      // Fetch all tickets for now, filtering can be done client-side or via API params
      // Assuming apiClient has getMaintenanceTickets method (we need to add it)
      const data = await apiClient.getMaintenanceTickets(activeTab === "all" ? undefined : activeTab as MaintenanceStatus);
      setTickets(data);
    } catch (error) {
      console.error("Failed to load tickets", error);
    } finally {
      setLoading(false);
    }
  }

  const getPriorityColor = (priority: MaintenancePriority) => {
    switch (priority) {
      case "critical": return "bg-status-error-bg text-status-error-text border-status-error-border";
      case "high": return "bg-status-warning-bg text-status-warning-text border-status-warning-border";
      case "medium": return "bg-status-warning-bg text-status-warning-text border-status-warning-border";
      case "low": return "bg-status-info-bg text-status-info-text border-status-info-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case "open": return "bg-status-info-bg text-status-info-text";
      case "in_progress": return "bg-status-warning-bg text-status-warning-text";
      case "closed": return "bg-status-success-bg text-status-success-text";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 pb-2 md:pb-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
            <HelpAnchor topicId="maintenance-work-orders" label="Maintenance help" />
          </div>
          <p className="text-slate-500">Track repairs, work orders, and site maintenance.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      <div className="grid gap-2 mb-4 md:hidden">
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="text-sm text-slate-600">Open / In progress</div>
            <div className="text-lg font-semibold text-slate-900">
              {tickets.filter((t) => t.status !== "closed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="text-sm text-slate-600">Closed today</div>
            <div className="text-lg font-semibold text-slate-900">
              {tickets.filter((t) => t.status === "closed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} defaultValue="open" onValueChange={setActiveTab} className="w-full pb-24 md:pb-10" id="maintenance-list">
        <TabsList className="mb-4 w-full overflow-x-auto rounded-xl p-1">
          <TabsTrigger value="open" className="flex-1 min-w-[120px]">Open</TabsTrigger>
          <TabsTrigger value="in_progress" className="flex-1 min-w-[120px]">In Progress</TabsTrigger>
          <TabsTrigger value="closed" className="flex-1 min-w-[120px]">Closed</TabsTrigger>
          <TabsTrigger value="all" className="flex-1 min-w-[120px]">All Tickets</TabsTrigger>
        </TabsList>

        <div className="grid gap-4">
          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 border rounded-lg bg-slate-50">
              <p className="text-slate-500">No tickets found.</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="relative overflow-hidden cursor-pointer hover:border-slate-400 transition-colors"
                onClick={() => setSelectedTicket(ticket as unknown as MaintenanceTicket)}
              >
                <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className={`hidden sm:block w-2 h-full absolute left-0 top-0 ${ticket.priority === 'critical' ? 'bg-red-500' :
                    ticket.priority === 'high' ? 'bg-orange-500' : 'bg-transparent'
                    }`} />

                  <div className="flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{ticket.title}</h3>
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
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <p className="text-slate-600 text-sm mb-3">{ticket.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                        Created {format(new Date(ticket.createdAt || new Date()), 'MMM d, yyyy')}
                      </span>
                      {ticket.siteId && (
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          Site: {ticket.siteId}
                        </span>
                      )}
                      {ticket.dueDate && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                          Due: {format(new Date(ticket.dueDate), 'MMM d')}
                        </span>
                      )}
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
          { key: "tasks", label: "Tasks", href: "#maintenance-list", icon: <ClipboardList className="h-4 w-4" />, badge: tickets.filter((t) => t.status !== "closed").length },
          { key: "messages", label: "Messages", href: "/messages", icon: <MessageSquare className="h-4 w-4" /> },
          { key: "checklists", label: "Checklists", href: "/operations#checklists", icon: <ClipboardCheck className="h-4 w-4" /> },
          { key: "ops-health", label: "Ops health", href: "/operations#ops-health", icon: <HeartPulse className="h-4 w-4" /> },
        ]}
      />
    </DashboardShell>
  );
}
