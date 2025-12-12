"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableEmpty } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Users, Send, User, Clock, CheckCheck, Search, Plus, Hash, ClipboardList, ClipboardCheck, HeartPulse } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { MobileQuickActionsBar } from "@/components/staff/MobileQuickActionsBar";

type Message = {
    id: string;
    content: string;
    senderType: "guest" | "staff";
    createdAt: string;
    readAt: string | null;
    guest?: { id: string; primaryFirstName: string; primaryLastName: string } | null;
};

type InternalMessage = {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    sender: { id: string; firstName: string; lastName: string; email: string };
};

type InternalConversation = {
    id: string;
    name: string | null;
    type: "channel" | "dm";
    participants: { user: { id: string; firstName: string; lastName: string; email: string } }[];
    messages?: { content: string; createdAt: string; senderId: string }[];
};

type Conversation = {
    reservationId: string;
    guestName: string;
    siteName: string;
    status: string;
    messages: Message[];
    unreadCount: number;
    lastMessage: Message | null;
};

export default function MessagesPage() {
    const { data: session } = useSession();
    const { toast } = useToast();
    const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [newInternalMessage, setNewInternalMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "failed">("all");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [activeTab, setActiveTab] = useState("guests");
    const [guestFilter, setGuestFilter] = useState<"all" | "overdue">("all");
    const [overdueNotified, setOverdueNotified] = useState(false);
    const activeFilterCount =
        (statusFilter !== "all" ? 1 : 0) +
        (dateRange.start ? 1 : 0) +
        (dateRange.end ? 1 : 0);

    // Internal Chat State
    const [selectedInternalConversationId, setSelectedInternalConversationId] = useState<string | null>(null);
    const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
    const [isCreateDMOpen, setIsCreateDMOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState("");
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

    const queryClient = useQueryClient();

    // Get campground
    const { data: campgrounds = [] } = useQuery({
        queryKey: ["campgrounds"],
        queryFn: () => apiClient.getCampgrounds()
    });
    const campground = campgrounds[0];
    const DEFAULT_SLA_MINUTES = Number(process.env.NEXT_PUBLIC_SLA_MINUTES || 30);
    const SLA_MINUTES = (campground as any)?.slaMinutes ?? DEFAULT_SLA_MINUTES;

    // Get reservations
    const { data: reservations = [] } = useQuery({
        queryKey: ["reservations", campground?.id],
        queryFn: () => apiClient.getReservations(campground!.id),
        enabled: !!campground?.id
    });

    // Get staff members
    const { data: staffMembers = [] } = useQuery({
        queryKey: ["campground-members", campground?.id],
        queryFn: () => apiClient.getCampgroundMembers(campground!.id),
        enabled: !!campground?.id
    });

    // Build conversations from reservations with messages
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(true);

    useEffect(() => {
        if (!reservations.length) {
            setLoadingConversations(false);
            return;
        }

        const loadMessages = async () => {
            setLoadingConversations(true);
            const convs: Conversation[] = [];

            for (const res of reservations as any[]) {
                try {
                    const messages = await apiClient.getReservationMessages(res.id);
                    const filteredMsgs = messages.filter((m: any) => {
                        const isFailed =
                            (m.status || "").toLowerCase().includes("fail") ||
                            (m.status || "").toLowerCase().includes("bounce") ||
                            (m.status || "").toLowerCase().includes("error");
                        const inStatus = statusFilter === "all" ? true : isFailed;
                        const withinDate = (() => {
                            if (!dateRange.start && !dateRange.end) return true;
                            const created = new Date(m.createdAt);
                            const startOk = dateRange.start ? created >= new Date(dateRange.start) : true;
                            const endOk = dateRange.end ? created <= new Date(dateRange.end) : true;
                            return startOk && endOk;
                        })();
                        return inStatus && withinDate;
                    });

                    if (filteredMsgs.length > 0) {
                        const unreadCount = filteredMsgs.filter(
                            (m) => m.senderType === "guest" && !m.readAt
                        ).length;
                        convs.push({
                            reservationId: res.id,
                            guestName: `${res.guest?.primaryFirstName || ""} ${res.guest?.primaryLastName || ""}`.trim() || "Unknown Guest",
                            siteName: res.site?.name || res.site?.siteNumber || "Unknown Site",
                            status: res.status,
                            messages: filteredMsgs,
                            unreadCount,
                            lastMessage: filteredMsgs[filteredMsgs.length - 1] || null,
                        });
                    }
                } catch {
                    // Skip if can't load messages
                }
            }

            convs.sort((a, b) => {
                const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
                const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
                return bTime - aTime;
            });

            if (convs.length === 0) {
                const now = new Date().toISOString();
                const demoConv: Conversation = {
                    reservationId: "demo-reservation",
                    guestName: "Demo Guest",
                    siteName: "Site A-1",
                    status: "confirmed",
                    unreadCount: 0,
                    messages: [
                        {
                            id: "demo-msg-1",
                            content: "Hey! Just testing the inbox. Everything looks good.",
                            senderType: "guest",
                            createdAt: now,
                            readAt: now,
                            guest: { id: "demo-guest", primaryFirstName: "Demo", primaryLastName: "Guest" }
                        }
                    ],
                    lastMessage: {
                        id: "demo-msg-1",
                        content: "Hey! Just testing the inbox. Everything looks good.",
                        senderType: "guest",
                        createdAt: now,
                        readAt: now,
                        guest: { id: "demo-guest", primaryFirstName: "Demo", primaryLastName: "Guest" }
                    }
                };
                setConversations([demoConv]);
            } else {
            setConversations(convs);
            }
            setLoadingConversations(false);
        };

        loadMessages();
    }, [reservations, statusFilter, dateRange]);

    // Mark internal conversation as seen when opened
    useEffect(() => {
        if (!campground?.id || !selectedInternalConversationId) return;
        const key = `campreserv:lastSeenInternal:${campground.id}:${selectedInternalConversationId}`;
        localStorage.setItem(key, new Date().toISOString());
    }, [campground?.id, selectedInternalConversationId]);

    // Get internal conversations
    const { data: internalConversations = [] } = useQuery({
        queryKey: ["internal-conversations", campground?.id],
        queryFn: () => apiClient.getInternalConversations(campground!.id),
        enabled: !!campground?.id
    });

    // Select General channel by default
    useEffect(() => {
        if (activeTab === "team" && !selectedInternalConversationId && internalConversations.length > 0) {
            const general = internalConversations.find(c => c.name === "General");
            if (general) setSelectedInternalConversationId(general.id);
        }
    }, [activeTab, internalConversations, selectedInternalConversationId]);

    // Get internal messages
    const { data: internalMessages = [] } = useQuery({
        queryKey: ["internal-messages", selectedInternalConversationId],
        queryFn: () => apiClient.getInternalMessages(selectedInternalConversationId!),
        enabled: !!selectedInternalConversationId,
        refetchInterval: 5000
    });

    const createConversationMutation = useMutation({
        mutationFn: (payload: { name?: string; type: "channel" | "dm"; participantIds: string[] }) =>
            apiClient.createInternalConversation(campground!.id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["internal-conversations"] });
            setIsCreateChannelOpen(false);
            setIsCreateDMOpen(false);
            setNewChannelName("");
            setSelectedParticipants([]);
        }
    });

    const handleCreateChannel = () => {
        if (!newChannelName.trim()) return;
        createConversationMutation.mutate({
            name: newChannelName,
            type: "channel",
            participantIds: selectedParticipants
        });
    };

    const handleCreateDM = () => {
        if (selectedParticipants.length === 0) return;
        createConversationMutation.mutate({
            type: "dm",
            participantIds: selectedParticipants
        });
    };

    const selectedConversation = conversations.find(c => c.reservationId === selectedReservationId);
    const selectedInternalConversation = internalConversations.find(c => c.id === selectedInternalConversationId);

    const handleSelectConversation = async (conv: Conversation) => {
        setSelectedReservationId(conv.reservationId);
        if (conv.unreadCount > 0) {
            try {
                await apiClient.markMessagesAsRead(conv.reservationId, "staff");
                setConversations(prev =>
                    prev.map(c =>
                        c.reservationId === conv.reservationId ? { ...c, unreadCount: 0 } : c
                    )
                );
            } catch { }
        }
    };

    const handleSendMessage = async () => {
        if (!selectedReservationId || !newMessage.trim()) return;
        const conv = conversations.find(c => c.reservationId === selectedReservationId);
        if (!conv) return;

        setSending(true);
        try {
            const guestId = conv.messages[0]?.guest?.id || "";
            const message = await apiClient.sendReservationMessage(
                selectedReservationId,
                newMessage.trim(),
                "staff",
                guestId
            );
            setConversations(prev =>
                prev.map(c =>
                    c.reservationId === selectedReservationId
                        ? { ...c, messages: [...c.messages, message as any], lastMessage: message as any }
                        : c
                )
            );
            setNewMessage("");
        } catch (err) {
            console.error("Failed to send message:", err);
        } finally {
            setSending(false);
        }
    };

    const handleSendInternalMessage = async () => {
        if (!selectedInternalConversationId || !newInternalMessage.trim()) return;
        setSending(true);
        try {
            await apiClient.sendInternalMessage(selectedInternalConversationId, newInternalMessage.trim());
            setNewInternalMessage("");
            queryClient.invalidateQueries({ queryKey: ["internal-messages", selectedInternalConversationId] });
        } catch (err) {
            console.error("Failed to send internal message:", err);
        } finally {
            setSending(false);
        }
    };

    const isConversationOverdue = (conv: Conversation) => {
        const overdueMessage = conv.messages
            .filter(m => m.senderType === "guest" && !m.readAt)
            .find(m => {
                const created = new Date(m.createdAt);
                const minutesSince = (Date.now() - created.getTime()) / 60000;
                return minutesSince > SLA_MINUTES;
            });
        return Boolean(overdueMessage);
    };

    const filteredConversations = conversations
        .filter(conv => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return conv.guestName.toLowerCase().includes(term) || conv.siteName.toLowerCase().includes(term);
        })
        .filter(conv => {
            if (guestFilter === "overdue") return isConversationOverdue(conv);
            return true;
    });

    const overdueConversations = conversations.filter(isConversationOverdue);
    const overdueCount = overdueConversations.length;
    const unreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    const totalConversations = conversations.length;

    useEffect(() => {
        if (overdueCount > 0 && !overdueNotified) {
            toast({
                title: "Overdue conversations",
                description: `${overdueCount} conversation(s) need reply (SLA ${SLA_MINUTES} min).`,
                variant: "default"
            });
            setOverdueNotified(true);
        }
        if (overdueCount === 0 && overdueNotified) {
            setOverdueNotified(false);
        }
    }, [overdueCount, SLA_MINUTES, overdueNotified, toast]);

    const filteredInternalConversations = internalConversations.filter(conv => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        if (conv.type === "channel") {
            return conv.name?.toLowerCase().includes(term);
        } else {
            const participants = conv.participants.map(p => `${p.user.firstName} ${p.user.lastName}`).join(", ");
            return participants.toLowerCase().includes(term);
        }
    });

    const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

    if (!campground) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">No Campground Selected</h2>
                        <p className="text-slate-600">Select a campground to view messages</p>
                    </div>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-4 pb-24 md:pb-10" id="messages-shell">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-500">Conversations</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="text-2xl font-semibold text-slate-900">{totalConversations}</div>
                            <div className="text-xs text-slate-500">Total active</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-500">Unread</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="text-2xl font-semibold text-slate-900">{unreadCount}</div>
                            <div className="text-xs text-slate-500">Guest messages unseen</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-500">Needs reply</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="text-2xl font-semibold text-amber-700">{overdueCount}</div>
                            <div className="text-xs text-slate-500">Over SLA ({SLA_MINUTES} min)</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Mobile quick actions */}
                <div className="md:hidden">
                    <div className="rounded-2xl border bg-white shadow-sm p-3 flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant={activeTab === "guests" ? "secondary" : "outline"}
                            className="flex-1 min-w-[120px]"
                            onClick={() => setActiveTab("guests")}
                        >
                            Guest inbox
                        </Button>
                        <Button
                            size="sm"
                            variant={activeTab === "team" ? "secondary" : "outline"}
                            className="flex-1 min-w-[120px]"
                            onClick={() => setActiveTab("team")}
                        >
                            Team chat
                        </Button>
                        <Button
                            size="sm"
                            variant={guestFilter === "overdue" ? "secondary" : "outline"}
                            className="flex-1 min-w-[120px]"
                            onClick={() => setGuestFilter(guestFilter === "overdue" ? "all" : "overdue")}
                        >
                            {guestFilter === "overdue" ? "All guests" : "Needs reply"}
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border bg-white shadow-sm p-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold">
                                {activeFilterCount} active
                                </span>
                            )}
                        </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex gap-1">
                            {(["all", "failed"] as const).map((f) => (
                                <button
                                    key={f}
                                    className={`rounded-full border px-2 py-1 text-[11px] ${statusFilter === f ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}
                                    onClick={() => setStatusFilter(f)}
                                >
                                    {f === "failed" ? "Failed only" : "All"}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <input
                                type="date"
                                className="rounded border border-slate-200 px-2 py-1"
                                value={dateRange.start}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                            />
                            <span>to</span>
                            <input
                                type="date"
                                className="rounded border border-slate-200 px-2 py-1"
                                value={dateRange.end}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    const start = new Date();
                                    start.setDate(start.getDate() - 6);
                                    const end = new Date();
                                    const fmt = (d: Date) => d.toISOString().slice(0, 10);
                                    setDateRange({ start: fmt(start), end: fmt(end) });
                                }}
                            >
                                Last 7 days
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    const today = new Date().toISOString().slice(0, 10);
                                    setDateRange({ start: today, end: today });
                                }}
                            >
                                Today
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDateRange({ start: "", end: "" })}>
                                Clear dates
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setDateRange({ start: "", end: "" });
                                    setStatusFilter("all");
                                    setSearchTerm("");
                                }}
                            >
                                Clear all
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:h-[calc(100vh-12rem)]">
                {/* Sidebar */}
                <Card className="w-full lg:w-80 flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Messages
                            {totalUnread > 0 && (
                                <Badge variant="destructive" className="ml-auto">
                                    {totalUnread}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 pb-2">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="guests" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>Guests</span>
                                    {overdueCount > 0 && (
                                        <Badge variant="destructive" className="ml-auto">
                                            {overdueCount} need reply
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="team" className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span>Team</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="px-4 pb-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                                {searchTerm && (
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                                        onClick={() => setSearchTerm("")}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-y-auto px-4" style={{ display: activeTab === "guests" ? "block" : "none", flex: activeTab === "guests" ? 1 : "none" }}>
                            <div className="flex items-center justify-between mb-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">SLA: {SLA_MINUTES} min</span>
                                    {overdueCount > 0 && (
                                        <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 text-[11px] font-semibold">
                                            {overdueCount} conversations need reply
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant={guestFilter === "all" ? "secondary" : "ghost"}
                                        onClick={() => setGuestFilter("all")}
                                    >
                                        All
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={guestFilter === "overdue" ? "secondary" : "ghost"}
                                        onClick={() => setGuestFilter("overdue")}
                                    >
                                        Needs reply
                                    </Button>
                                </div>
                            </div>
                            {loadingConversations ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground py-4 border border-dashed rounded-md bg-muted/30">
                                    <MessageSquare className="h-8 w-8 opacity-50" />
                                    <p>No guest conversations yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2 pb-4">
                                    {filteredConversations.map(conv => (
                                        <button
                                            key={conv.reservationId}
                                            onClick={() => handleSelectConversation(conv)}
                                            className={`w-full text-left p-3 rounded-lg transition-colors ${selectedReservationId === conv.reservationId
                                                ? "bg-primary/10 border border-primary/20"
                                                : "hover:bg-muted"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="font-medium truncate">{conv.guestName}</div>
                                                {conv.unreadCount > 0 && (
                                                    <Badge variant="destructive" className="ml-2 flex-shrink-0">
                                                        {conv.unreadCount}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground truncate">
                                                {conv.siteName} • {conv.status.replace("_", " ")}
                                            </div>
                                            {conv.lastMessage && (
                                                <div className="text-sm text-muted-foreground truncate mt-1">
                                                    {conv.lastMessage.senderType === "staff" && "You: "}
                                                    {conv.lastMessage.content}
                                                </div>
                                            )}
                                            {conv.lastMessage && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="overflow-y-auto px-4" style={{ display: activeTab === "team" ? "block" : "none", flex: activeTab === "team" ? 1 : "none" }}>
                            <div className="space-y-4 pb-4">
                                {/* Quick link to guest failed filter */}
                                <div className="flex justify-end px-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs"
                                        onClick={() => {
                                            setStatusFilter("failed");
                                            setActiveTab("guests");
                                        }}
                                    >
                                        View failed guest comms
                                    </Button>
                                </div>
                                {/* Channels */}
                                <div>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <h3 className="text-sm font-semibold text-muted-foreground">Channels</h3>
                                        <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Create Channel</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label>Channel Name</Label>
                                                        <Input
                                                            placeholder="e.g. maintenance"
                                                            value={newChannelName}
                                                            onChange={(e) => setNewChannelName(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Add Members</Label>
                                                        <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                                                            {staffMembers
                                                                .filter(member => member.user?.id)
                                                                .map(member => (
                                                                    <div key={member.id} className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id={`c-${member.user.id}`}
                                                                            checked={selectedParticipants.includes(member.user.id)}
                                                                            onCheckedChange={(checked) => {
                                                                                const uid = member.user.id;
                                                                                if (!uid) return;
                                                                                if (checked) setSelectedParticipants([...selectedParticipants, uid]);
                                                                                else setSelectedParticipants(selectedParticipants.filter(id => id !== uid));
                                                                            }}
                                                                        />
                                                                        <Label htmlFor={`c-${member.user.id}`}>{member.user.firstName ?? ""} {member.user.lastName ?? ""}</Label>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button onClick={handleCreateChannel} disabled={createConversationMutation.isPending || !newChannelName}>
                                                        Create Channel
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <div className="space-y-1">
                                        {filteredInternalConversations.filter(c => c.type === "channel").map(conv => (
                                            <button
                                                key={conv.id}
                                                onClick={() => setSelectedInternalConversationId(conv.id)}
                                                className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${selectedInternalConversationId === conv.id
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "hover:bg-muted text-muted-foreground"
                                                    }`}
                                            >
                                                <Hash className="h-4 w-4" />
                                                {conv.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Direct Messages */}
                                <div>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <h3 className="text-sm font-semibold text-muted-foreground">Direct Messages</h3>
                                        <Dialog open={isCreateDMOpen} onOpenChange={setIsCreateDMOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>New Message</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label>Select Person</Label>
                                                        <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-2">
                                                            {staffMembers
                                                                .filter(m => m.user?.id && m.user.id !== session?.user?.id)
                                                                .map(member => (
                                                                    <div key={member.id} className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id={`dm-${member.user.id}`}
                                                                            checked={selectedParticipants.includes(member.user.id)}
                                                                            onCheckedChange={(checked) => {
                                                                                const uid = member.user.id;
                                                                                if (!uid) return;
                                                                                if (checked) setSelectedParticipants([...selectedParticipants, uid]);
                                                                                else setSelectedParticipants(selectedParticipants.filter(id => id !== uid));
                                                                            }}
                                                                        />
                                                                        <Label htmlFor={`dm-${member.user.id}`}>{member.user.firstName ?? ""} {member.user.lastName ?? ""}</Label>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button onClick={handleCreateDM} disabled={createConversationMutation.isPending || selectedParticipants.length === 0}>
                                                        Start Chat
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <div className="space-y-1">
                                        {filteredInternalConversations.filter(c => c.type === "dm").map(conv => {
                                            const otherParticipants = conv.participants
                                                .filter(p => p.user.id !== session?.user?.id)
                                                .map(p => `${p.user.firstName} ${p.user.lastName}`)
                                                .join(", ");
                                            return (
                                                <button
                                                    key={conv.id}
                                                    onClick={() => setSelectedInternalConversationId(conv.id)}
                                                    className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${selectedInternalConversationId === conv.id
                                                        ? "bg-primary/10 text-primary font-medium"
                                                        : "hover:bg-muted text-muted-foreground"
                                                        }`}
                                                >
                                                    <User className="h-4 w-4" />
                                                    <span className="truncate">{otherParticipants || "Me"}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Tabs>
                </Card>

                {/* Main Content - Conversation View */}
                <Card className="flex-1 flex flex-col min-h-[320px]">
                    {activeTab === "team" ? (
                        selectedInternalConversation ? (
                            <>
                                <CardHeader className="border-b">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                {selectedInternalConversation.type === "channel" ? <Hash className="h-5 w-5" /> : <User className="h-5 w-5" />}
                                                {selectedInternalConversation.type === "channel"
                                                    ? selectedInternalConversation.name
                                                    : selectedInternalConversation.participants
                                                        .filter(p => p.user.id !== session?.user?.id)
                                                        .map(p => `${p.user.firstName} ${p.user.lastName}`)
                                                        .join(", ") || "Me"}
                                            </CardTitle>
                                            <CardDescription>
                                                {selectedInternalConversation.participants.length} members
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>

                                <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                                    <div className="space-y-4">
                                        {(internalMessages as InternalMessage[]).length === 0 ? (
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground py-4 border border-dashed rounded-md bg-muted/30">
                                                <MessageSquare className="h-8 w-8 opacity-50" />
                                                <p>No messages yet</p>
                                            </div>
                                        ) : (
                                            (internalMessages as InternalMessage[]).map((msg) => (
                                                <div key={msg.id} className={`flex flex-col gap-1 ${msg.senderId === session?.user?.id ? "items-end" : "items-start"}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">
                                                            {msg.sender.firstName} {msg.sender.lastName}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(msg.createdAt), "h:mm a")}
                                                        </span>
                                                    </div>
                                                    <div className={`p-3 rounded-lg max-w-[85%] sm:max-w-[80%] ${msg.senderId === session?.user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                                        <div className="text-sm">{msg.content}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={`Message ${selectedInternalConversation.type === "channel" ? `#${selectedInternalConversation.name}` : "team member"}...`}
                                            value={newInternalMessage}
                                            onChange={(e) => setNewInternalMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSendInternalMessage()}
                                        />
                                        <Button onClick={handleSendInternalMessage} disabled={sending || !newInternalMessage.trim()}>
                                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Select a channel or conversation</p>
                                </div>
                            </div>
                        )
                    ) : selectedConversation ? (
                        <>
                            <CardHeader className="border-b">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle>{selectedConversation.guestName}</CardTitle>
                                        <CardDescription>{selectedConversation.siteName}</CardDescription>
                                    </div>
                                    <Badge variant={selectedConversation.status === "checked_in" ? "default" : "secondary"}>
                                        {selectedConversation.status.replace("_", " ")}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                                <div className="space-y-4">
                                    {selectedConversation.messages.map((msg) => {
                                        const isStaff = msg.senderType === "staff";
                                        const badgeClasses = isStaff
                                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                                            : "bg-emerald-100 text-emerald-700 border border-emerald-200";
                                        return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isStaff ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-3 ${isStaff
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${badgeClasses}`}>
                                                        {isStaff ? "Staff" : "Guest"}
                                                    </span>
                                                </div>
                                                <div className="text-sm">{msg.content}</div>
                                                <div
                                                    className={`flex items-center gap-1 mt-1 text-xs ${isStaff ? "text-primary-foreground/70" : "text-muted-foreground"
                                                        }`}
                                                >
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(msg.createdAt), "h:mm a")}
                                                    {isStaff && msg.readAt && (
                                                        <CheckCheck className="h-3 w-3 ml-1" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );})}
                                </div>
                            </div>

                            <div className="p-4 border-t">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                    />
                                    <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Select a conversation</p>
                                <p className="text-sm">Choose a guest conversation to view messages</p>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
            <MobileQuickActionsBar
              active="messages"
              items={[
                { key: "tasks", label: "Tasks", href: "/operations#housekeeping", icon: <ClipboardList className="h-4 w-4" /> },
                { key: "messages", label: "Messages", href: "#messages-shell", icon: <MessageSquare className="h-4 w-4" />, badge: totalUnread },
                { key: "checklists", label: "Checklists", href: "/operations#checklists", icon: <ClipboardCheck className="h-4 w-4" /> },
                { key: "ops-health", label: "Ops health", href: "/operations#ops-health", icon: <HeartPulse className="h-4 w-4" /> },
              ]}
            />
            </div>
        </DashboardShell>
    );
}
