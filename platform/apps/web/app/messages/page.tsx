"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableEmpty } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Users, Send, User, Clock, CheckCheck, Search, Plus, Hash, ClipboardList, ClipboardCheck, HeartPulse, Info, AlertCircle, Sparkles, Bell, Mail, Phone, Calendar, MapPin, DollarSign, PawPrint, ChevronRight, ExternalLink, X, Tent, PenSquare } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { MobileQuickActionsBar } from "@/components/staff/MobileQuickActionsBar";
import { cn } from "@/lib/utils";

const SPRING_CONFIG = {
    type: "spring" as const,
    stiffness: 300,
    damping: 25,
};

type Message = {
    id: string;
    content: string;
    senderType: "guest" | "staff";
    createdAt: string;
    readAt: string | null;
    guest?: { id: string; primaryFirstName: string | null; primaryLastName: string | null } | null;
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
    guestEmail: string | null;
    guestPhone: string | null;
    guestId: string | null;
    siteName: string;
    siteType: string | null;
    status: string;
    arrivalDate: string | null;
    departureDate: string | null;
    adults: number | null;
    children: number | null;
    pets: number | null;
    totalAmountCents: number | null;
    notes: string | null;
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
    const [sendSuccess, setSendSuccess] = useState(false);
    const [showGuestInfo, setShowGuestInfo] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Compose message state
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeType, setComposeType] = useState<"message" | "email" | "sms">("message");
    const [composeGuestSearch, setComposeGuestSearch] = useState("");
    const [composeSelectedGuest, setComposeSelectedGuest] = useState<{ id: string; name: string; email?: string; phone?: string; reservations?: { id: string; siteName: string; arrivalDate: string; status: string }[] } | null>(null);
    const [composeSelectedReservation, setComposeSelectedReservation] = useState<{ id: string; siteName: string; arrivalDate: string } | null>(null);
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [composeSending, setComposeSending] = useState(false);
    const prevUnreadCountRef = useRef<number>(0);
    const isInitialLoadRef = useRef(true);
    const activeFilterCount =
        (statusFilter !== "all" ? 1 : 0) +
        (dateRange.start ? 1 : 0) +
        (dateRange.end ? 1 : 0);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            // Cmd/Ctrl + K: Focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;
                searchInput?.focus();
            }

            // G then G: Go to guests tab
            // G then T: Go to team tab
            // G then N: Go to needs reply
            if (e.key === 'g') {
                const handleSecondKey = (e2: KeyboardEvent) => {
                    if (e2.key === 'g') {
                        setActiveTab('guests');
                        setGuestFilter('all');
                    } else if (e2.key === 't') {
                        setActiveTab('team');
                    } else if (e2.key === 'n') {
                        setActiveTab('guests');
                        setGuestFilter('overdue');
                    }
                    window.removeEventListener('keydown', handleSecondKey);
                };
                window.addEventListener('keydown', handleSecondKey);
                setTimeout(() => window.removeEventListener('keydown', handleSecondKey), 1000);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // Internal Chat State
    const [selectedInternalConversationId, setSelectedInternalConversationId] = useState<string | null>(null);
    const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
    const [isCreateDMOpen, setIsCreateDMOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState("");
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

    // SMS Conversations State
    const [selectedSmsConversationId, setSelectedSmsConversationId] = useState<string | null>(null);
    const [newSmsMessage, setNewSmsMessage] = useState("");
    const [sendingSms, setSendingSms] = useState(false);

    const queryClient = useQueryClient();

    // Get campground
    const { data: campgrounds = [] } = useQuery({
        queryKey: ["campgrounds"],
        queryFn: () => apiClient.getCampgrounds()
    });
    const campground = campgrounds[0];
    const DEFAULT_SLA_MINUTES = Number(process.env.NEXT_PUBLIC_SLA_MINUTES || 30);
    const SLA_MINUTES = (campground && 'slaMinutes' in campground && typeof campground.slaMinutes === 'number')
        ? campground.slaMinutes
        : DEFAULT_SLA_MINUTES;

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

    // Get guests for compose search - only when user starts typing
    const { data: searchedGuests = [] } = useQuery({
        queryKey: ["guests-search", campground?.id, composeGuestSearch],
        queryFn: () => apiClient.getGuests(campground!.id, {
            search: composeGuestSearch,
            limit: 20
        }),
        enabled: !!campground?.id && composeGuestSearch.length >= 2,
        staleTime: 30000
    });

    // Fetch all conversations in a single API call (much faster than N sequential calls)
    // Poll every 5 seconds for real-time updates
    const { data: rawConversations = [], isLoading: loadingConversations } = useQuery({
        queryKey: ["conversations", campground?.id],
        queryFn: () => apiClient.getConversations(campground!.id),
        enabled: !!campground?.id,
        staleTime: 4000, // Consider stale after 4 seconds
        refetchInterval: 5000, // Poll every 5 seconds for real-time updates
        refetchIntervalInBackground: false, // Don't poll when tab is not focused
    });

    // Apply client-side filters and transform to expected format
    const conversations = useMemo((): Conversation[] => {
        if (!rawConversations.length) {
            // Show demo conversation if no real ones
            const now = new Date().toISOString();
            return [{
                reservationId: "demo-reservation",
                guestName: "Demo Guest",
                guestEmail: "demo@example.com",
                guestPhone: "(555) 123-4567",
                guestId: "demo-guest",
                siteName: "Site A-1",
                siteType: "RV",
                status: "confirmed",
                arrivalDate: now,
                departureDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                adults: 2,
                children: 1,
                pets: 0,
                totalAmountCents: 15000,
                notes: null,
                unreadCount: 0,
                messages: [
                    {
                        id: "demo-msg-1",
                        content: "Hey! Just testing the inbox. Everything looks good.",
                        senderType: "guest" as const,
                        createdAt: now,
                        readAt: now,
                        guest: { id: "demo-guest", primaryFirstName: "Demo", primaryLastName: "Guest" }
                    }
                ],
                lastMessage: {
                    id: "demo-msg-1",
                    content: "Hey! Just testing the inbox. Everything looks good.",
                    senderType: "guest" as const,
                    createdAt: now,
                    readAt: now,
                    guest: { id: "demo-guest", primaryFirstName: "Demo", primaryLastName: "Guest" }
                }
            }];
        }

        // Transform raw conversations to expected format
        return rawConversations.map((conv: any) => {
            // Apply date filter if set
            const filteredMsgs = dateRange.start || dateRange.end
                ? conv.messages.filter((m: any) => {
                    const created = new Date(m.createdAt);
                    const startOk = dateRange.start ? created >= new Date(dateRange.start) : true;
                    const endOk = dateRange.end ? created <= new Date(dateRange.end) : true;
                    return startOk && endOk;
                })
                : conv.messages;

            return {
                reservationId: conv.reservationId,
                guestName: conv.guestName,
                guestEmail: conv.guestEmail || null,
                guestPhone: conv.guestPhone || null,
                guestId: conv.guestId || null,
                siteName: conv.siteName,
                siteType: conv.siteType || null,
                status: conv.status,
                arrivalDate: conv.arrivalDate || null,
                departureDate: conv.departureDate || null,
                adults: conv.adults || null,
                children: conv.children || null,
                pets: conv.pets || null,
                totalAmountCents: conv.totalAmountCents || null,
                notes: conv.notes || null,
                messages: filteredMsgs,
                unreadCount: filteredMsgs.filter((m: any) => m.senderType === "guest" && !m.readAt).length,
                lastMessage: filteredMsgs[filteredMsgs.length - 1] || null
            } as Conversation;
        });
    }, [rawConversations, dateRange]);

    // Play notification sound helper
    const playNotificationSound = () => {
        try {
            const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return;
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 600;
            oscillator.type = "sine";
            gainNode.gain.value = 0.15;
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            // Audio not available, ignore
        }
    };

    // Detect new messages and show notifications
    useEffect(() => {
        const currentUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

        // Skip notification on initial load
        if (isInitialLoadRef.current) {
            prevUnreadCountRef.current = currentUnread;
            isInitialLoadRef.current = false;
            return;
        }

        // New unread messages arrived
        if (currentUnread > prevUnreadCountRef.current) {
            const newMessageCount = currentUnread - prevUnreadCountRef.current;
            playNotificationSound();
            toast({
                title: `${newMessageCount} new message${newMessageCount > 1 ? "s" : ""}`,
                description: "A guest sent you a message",
                duration: 5000,
            });

            // Try browser notification if permitted
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("New guest message", {
                    body: `You have ${newMessageCount} new message${newMessageCount > 1 ? "s" : ""} from guests`,
                    icon: "/favicon.ico",
                });
            }
        }

        prevUnreadCountRef.current = currentUnread;
    }, [conversations, toast]);

    // Request notification permission on mount
    useEffect(() => {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    // Function to update conversations after sending a message
    const updateConversationMessages = (reservationId: string, newMessage: Message) => {
        queryClient.setQueryData(["conversations", campground?.id], (old: typeof rawConversations) => {
            if (!old) return old;
            return old.map(conv =>
                conv.reservationId === reservationId
                    ? { ...conv, messages: [...conv.messages, newMessage], lastMessage: newMessage }
                    : conv
            );
        });
    };

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

    // SMS Conversations
    const { data: smsConversations = [], isLoading: loadingSmsConversations } = useQuery({
        queryKey: ["sms-conversations", campground?.id],
        queryFn: () => apiClient.getSmsConversations(campground!.id),
        enabled: !!campground?.id,
        staleTime: 4000,
        refetchInterval: 5000,
        refetchIntervalInBackground: false
    });

    const smsUnreadCount = smsConversations.reduce((acc, c) => acc + c.unreadCount, 0);

    const { data: selectedSmsMessages } = useQuery({
        queryKey: ["sms-messages", selectedSmsConversationId, campground?.id],
        queryFn: () => apiClient.getSmsConversation(selectedSmsConversationId!, campground!.id),
        enabled: !!selectedSmsConversationId && !!campground?.id,
        refetchInterval: 5000
    });

    const selectedSmsConversation = smsConversations.find(c => c.conversationId === selectedSmsConversationId);

    const handleSelectSmsConversation = async (conv: typeof smsConversations[0]) => {
        setSelectedSmsConversationId(conv.conversationId);
        if (conv.unreadCount > 0) {
            try {
                await apiClient.markSmsConversationRead(conv.conversationId, campground!.id);
                queryClient.setQueryData(["sms-conversations", campground?.id], (old: typeof smsConversations) => {
                    if (!old) return old;
                    return old.map(c =>
                        c.conversationId === conv.conversationId
                            ? { ...c, unreadCount: 0 }
                            : c
                    );
                });
            } catch { }
        }
    };

    const handleSendSmsReply = async () => {
        if (!selectedSmsConversationId || !newSmsMessage.trim() || !campground?.id) return;
        setSendingSms(true);
        try {
            await apiClient.replySmsConversation(selectedSmsConversationId, campground.id, newSmsMessage.trim());
            setNewSmsMessage("");
            queryClient.invalidateQueries({ queryKey: ["sms-messages", selectedSmsConversationId] });
            queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
            toast({
                title: "SMS sent",
                description: "Your message was delivered.",
                variant: "default"
            });
        } catch (err) {
            console.error("Failed to send SMS:", err);
            toast({
                title: "Failed to send SMS",
                description: "Please try again.",
                variant: "destructive"
            });
        } finally {
            setSendingSms(false);
        }
    };

    // Compose and send new message
    const handleComposeSubmit = async () => {
        if (!composeSelectedGuest || !composeBody.trim() || !campground?.id) return;

        // For in-app messages, require a reservation
        if (composeType === "message") {
            if (!composeSelectedReservation) {
                toast({
                    title: "Reservation required",
                    description: "Please select a reservation to send the message to.",
                    variant: "destructive"
                });
                return;
            }

            setComposeSending(true);
            try {
                await apiClient.sendReservationMessage(
                    composeSelectedReservation.id,
                    composeBody.trim(),
                    "staff",
                    composeSelectedGuest.id
                );

                toast({
                    title: "Message sent",
                    description: `Your message was sent to ${composeSelectedGuest.name}'s portal inbox.`,
                    variant: "default"
                });

                // Reset form and close dialog
                setIsComposeOpen(false);
                setComposeSelectedGuest(null);
                setComposeSelectedReservation(null);
                setComposeGuestSearch("");
                setComposeSubject("");
                setComposeBody("");
                setComposeType("message");

                // Refresh conversations
                queryClient.invalidateQueries({ queryKey: ["conversations"] });
            } catch (err) {
                console.error("Failed to send message:", err);
                toast({
                    title: "Failed to send message",
                    description: "Please try again.",
                    variant: "destructive"
                });
            } finally {
                setComposeSending(false);
            }
            return;
        }

        // Validate recipient address for email/SMS
        const toAddress = composeType === "email" ? composeSelectedGuest.email : composeSelectedGuest.phone;
        if (!toAddress) {
            toast({
                title: composeType === "email" ? "No email address" : "No phone number",
                description: `This guest doesn't have a ${composeType === "email" ? "email address" : "phone number"} on file.`,
                variant: "destructive"
            });
            return;
        }

        // Validate subject for email
        if (composeType === "email" && !composeSubject.trim()) {
            toast({
                title: "Subject required",
                description: "Please enter a subject for the email.",
                variant: "destructive"
            });
            return;
        }

        setComposeSending(true);
        try {
            await apiClient.sendCommunication({
                campgroundId: campground.id,
                guestId: composeSelectedGuest.id,
                type: composeType,
                direction: "outbound",
                subject: composeType === "email" ? composeSubject.trim() : undefined,
                body: composeBody.trim(),
                toAddress
            });

            toast({
                title: composeType === "email" ? "Email sent" : "SMS sent",
                description: `Your message was sent to ${composeSelectedGuest.name}.`,
                variant: "default"
            });

            // Reset form and close dialog
            setIsComposeOpen(false);
            setComposeSelectedGuest(null);
            setComposeSelectedReservation(null);
            setComposeGuestSearch("");
            setComposeSubject("");
            setComposeBody("");
            setComposeType("message");

            // Refresh conversations
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
        } catch (err) {
            console.error("Failed to send message:", err);
            toast({
                title: "Failed to send message",
                description: "Please try again.",
                variant: "destructive"
            });
        } finally {
            setComposeSending(false);
        }
    };

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
                // Update the cache to mark messages as read
                queryClient.setQueryData(["conversations", campground?.id], (old: typeof rawConversations) => {
                    if (!old) return old;
                    return old.map(c =>
                        c.reservationId === conv.reservationId
                            ? {
                                ...c,
                                unreadCount: 0,
                                messages: c.messages.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() }))
                            }
                            : c
                    );
                });
            } catch { }
        }
    };

    const handleSendMessage = async () => {
        if (!selectedReservationId || !newMessage.trim()) return;
        const conv = conversations.find(c => c.reservationId === selectedReservationId);
        if (!conv) return;

        setSending(true);
        const messageContent = newMessage.trim();
        try {
            const guestId = conv.messages[0]?.guest?.id || "";
            const messageResult = await apiClient.sendReservationMessage(
                selectedReservationId,
                messageContent,
                "staff",
                guestId
            );
            // API returns minimal object; construct full message for UI
            const message: Message = {
                id: messageResult.id,
                content: messageContent,
                senderType: "staff",
                createdAt: new Date().toISOString(),
                readAt: null
            };
            updateConversationMessages(selectedReservationId, message);
            setNewMessage("");
            setSendSuccess(true);
            setTimeout(() => setSendSuccess(false), 1500);
            toast({
                title: "Message sent",
                description: "Your message was delivered to the guest.",
                variant: "default"
            });
            // Scroll to bottom after sending
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } catch (err) {
            console.error("Failed to send message:", err);
            toast({
                title: "Failed to send message",
                description: "Please try again or contact support if the problem persists.",
                variant: "destructive"
            });
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
            toast({
                title: "Failed to send message",
                description: "Please try again or contact support if the problem persists.",
                variant: "destructive"
            });
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
                        <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
                        <p className="text-muted-foreground">Select a campground to view messages</p>
                    </div>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-4 pb-24 md:pb-10" id="messages-shell">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING_CONFIG}
                    className="flex items-center justify-between mb-2"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-muted-foreground hidden md:block">
                            Shortcuts: <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">⌘K</kbd> search • <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">GN</kbd> needs reply
                        </div>
                        <Button
                            onClick={() => setIsComposeOpen(true)}
                            className="flex items-center gap-2"
                        >
                            <PenSquare className="h-4 w-4" />
                            <span className="hidden sm:inline">Compose</span>
                        </Button>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.05 }}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
                >
                    <Card className="group hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 transition-colors group-hover:text-blue-500" />
                                Conversations
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="text-2xl font-semibold text-foreground">{totalConversations}</div>
                            <div className="text-xs text-muted-foreground">Total active</div>
                        </CardContent>
                    </Card>
                    <Card className="group hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Unread</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="text-2xl font-semibold text-foreground">{unreadCount}</div>
                            <div className="text-xs text-muted-foreground">Guest messages unseen</div>
                        </CardContent>
                    </Card>
                    <Card className={cn(
                        "group transition-all",
                        overdueCount > 0
                            ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20 hover:shadow-amber-100 dark:hover:shadow-amber-900/50"
                            : "hover:shadow-md"
                    )}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                                <Clock className={cn(
                                    "h-4 w-4 transition-colors",
                                    overdueCount > 0 ? "text-amber-600 dark:text-amber-400" : "group-hover:text-emerald-500"
                                )} />
                                Needs reply
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className={cn(
                                "text-2xl font-semibold",
                                overdueCount > 0
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-emerald-700 dark:text-emerald-400"
                            )}>
                                {overdueCount}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {overdueCount > 0 ? `Over ${SLA_MINUTES} min SLA` : `Within ${SLA_MINUTES} min SLA`}
                            </div>
                            {overdueCount > 0 && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 w-full border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs"
                                    onClick={() => {
                                        setActiveTab("guests");
                                        setGuestFilter("overdue");
                                    }}
                                >
                                    View overdue
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Mobile quick actions */}
                <div className="md:hidden">
                    <div className="rounded-2xl border bg-card shadow-sm p-2 flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant={activeTab === "guests" && guestFilter === "all" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => {
                                setActiveTab("guests");
                                setGuestFilter("all");
                            }}
                        >
                            <User className="h-4 w-4 mr-1.5" />
                            Guests
                        </Button>
                        <Button
                            size="sm"
                            variant={activeTab === "guests" && guestFilter === "overdue" ? "destructive" : "outline"}
                            className="flex-1 relative"
                            onClick={() => {
                                setActiveTab("guests");
                                setGuestFilter("overdue");
                            }}
                        >
                            <Clock className="h-4 w-4 mr-1.5" />
                            Needs reply
                            {overdueCount > 0 && (
                                <Badge variant="secondary" className="ml-1.5 bg-white/20 text-[10px] px-1">
                                    {overdueCount}
                                </Badge>
                            )}
                        </Button>
                        <Button
                            size="sm"
                            variant={activeTab === "team" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setActiveTab("team")}
                        >
                            <Users className="h-4 w-4 mr-1.5" />
                            Team
                        </Button>
                    </div>
                </div>

                {/* Advanced filters - only show if needed */}
                {(statusFilter !== "all" || dateRange.start || dateRange.end || activeFilterCount > 0) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-2xl border bg-card shadow-sm p-3 flex flex-col gap-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Advanced Filters</span>
                                {activeFilterCount > 0 && (
                                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[11px] font-semibold">
                                        {activeFilterCount} active
                                    </span>
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setDateRange({ start: "", end: "" });
                                    setStatusFilter("all");
                                    setSearchTerm("");
                                }}
                                className="text-xs"
                            >
                                Clear all
                            </Button>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                            {/* Status filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-medium">Status:</span>
                                <div className="flex gap-1">
                                    {(["all", "failed"] as const).map((f) => (
                                        <button
                                            key={f}
                                            className={cn(
                                                "rounded-full border px-3 py-1 text-xs transition-colors",
                                                statusFilter === f
                                                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 font-medium"
                                                    : "border-border text-muted-foreground hover:border-muted-foreground"
                                            )}
                                            onClick={() => setStatusFilter(f)}
                                        >
                                            {f === "failed" ? "Failed messages" : "All messages"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date range filter */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground font-medium">Date:</span>
                                <div className="flex items-center gap-2 text-xs">
                                    <input
                                        type="date"
                                        className="rounded border border-input bg-background text-foreground px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                                    />
                                    <span className="text-muted-foreground">to</span>
                                    <input
                                        type="date"
                                        className="rounded border border-input bg-background text-foreground px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7"
                                        onClick={() => {
                                            const today = new Date().toISOString().slice(0, 10);
                                            setDateRange({ start: today, end: today });
                                        }}
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7"
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
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

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
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="guests" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>Guests</span>
                                    {overdueCount > 0 && (
                                        <Badge variant="destructive" className="ml-auto text-[10px] px-1.5">
                                            {overdueCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="sms" className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    <span>SMS</span>
                                    {smsUnreadCount > 0 && (
                                        <Badge variant="destructive" className="ml-auto text-[10px] px-1.5">
                                            {smsUnreadCount}
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
                                    placeholder={activeTab === "guests" ? "Search guests or sites..." : "Search channels or people..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                    title={activeTab === "guests" ? "Search by guest name or site number" : "Search by channel name or team member"}
                                />
                                {searchTerm && (
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                                        onClick={() => setSearchTerm("")}
                                        aria-label="Clear search"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Guest filter controls - always visible above list */}
                        {activeTab === "guests" && (
                            <div className="px-4 pb-3 border-b">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant={guestFilter === "all" ? "default" : "outline"}
                                            onClick={() => setGuestFilter("all")}
                                            className="flex-1 sm:flex-none"
                                        >
                                            All guests
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={guestFilter === "overdue" ? "destructive" : "outline"}
                                            onClick={() => setGuestFilter("overdue")}
                                            className="flex-1 sm:flex-none"
                                        >
                                            Needs reply
                                            {overdueCount > 0 && (
                                                <Badge variant="secondary" className="ml-1.5 bg-white/20">
                                                    {overdueCount}
                                                </Badge>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <span>SLA: {SLA_MINUTES} min</span>
                                        <div className="group relative">
                                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            <div className="invisible group-hover:visible absolute left-0 top-5 z-50 w-64 p-2 bg-popover text-popover-foreground text-xs rounded-md border shadow-lg">
                                                Service Level Agreement: Guest messages should be replied to within {SLA_MINUTES} minutes. Overdue conversations are highlighted in amber.
                                            </div>
                                        </div>
                                        {overdueCount > 0 && guestFilter === "all" && (
                                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                                                • {overdueCount} overdue
                                            </span>
                                        )}
                                    </div>
                                    {statusFilter === "all" && (
                                        <button
                                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                            onClick={() => setStatusFilter("failed")}
                                            title="View messages that failed to send"
                                        >
                                            <AlertCircle className="h-3 w-3" />
                                            View failed
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="overflow-y-auto px-4" style={{ display: activeTab === "guests" ? "block" : "none", flex: activeTab === "guests" ? 1 : "none" }}>
                            {loadingConversations ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col items-center gap-3 text-center py-8 px-4 border border-dashed rounded-lg bg-muted/30"
                                >
                                    {guestFilter === "overdue" ? (
                                        <>
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30"
                                            >
                                                <Sparkles className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                                            </motion.div>
                                            <div>
                                                <p className="font-semibold text-foreground">All caught up!</p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    No conversations need reply. Great work staying on top of guest messages!
                                                </p>
                                            </div>
                                        </>
                                    ) : searchTerm ? (
                                        <>
                                            <Search className="h-10 w-10 text-muted-foreground/50" />
                                            <div>
                                                <p className="font-medium text-foreground">No matches found</p>
                                                <p className="text-sm text-muted-foreground mt-1">Try searching for a different guest or site</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
                                            <div>
                                                <p className="font-medium text-foreground">No guest messages yet</p>
                                                <p className="text-sm text-muted-foreground mt-1">Guest conversations will appear here when they send messages</p>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            ) : (
                                <div className="space-y-2 pb-4">
                                    <AnimatePresence mode="popLayout">
                                        {filteredConversations.map((conv, index) => {
                                            const isOverdue = isConversationOverdue(conv);
                                            return (
                                            <motion.button
                                                key={conv.reservationId}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ delay: index * 0.02, duration: 0.2 }}
                                                layout
                                                onClick={() => handleSelectConversation(conv)}
                                                className={cn(
                                                    "w-full text-left p-3 rounded-lg transition-all duration-200 relative group",
                                                    selectedReservationId === conv.reservationId
                                                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                                                        : isOverdue
                                                        ? "bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800"
                                                        : "hover:bg-muted border border-transparent hover:border-border"
                                                )}
                                            >
                                                {/* Overdue indicator stripe */}
                                                {isOverdue && (
                                                    <motion.div
                                                        layoutId={`overdue-${conv.reservationId}`}
                                                        className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 dark:bg-amber-400 rounded-l-lg"
                                                    />
                                                )}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="font-medium truncate flex items-center gap-2 text-foreground">
                                                        {conv.guestName}
                                                        {isOverdue && (
                                                            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-[10px] px-1.5 py-0">
                                                                SLA
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {conv.unreadCount > 0 && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        >
                                                            <Badge variant="destructive" className="ml-2 flex-shrink-0">
                                                                {conv.unreadCount}
                                                            </Badge>
                                                        </motion.div>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground truncate">
                                                    {conv.siteName} • {conv.status.replace("_", " ")}
                                                </div>
                                                {conv.lastMessage && (
                                                    <div className="text-sm text-muted-foreground truncate mt-1">
                                                        {conv.lastMessage.senderType === "staff" && <span className="font-medium">You: </span>}
                                                        {conv.lastMessage.content}
                                                    </div>
                                                )}
                                                {conv.lastMessage && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}
                                                    </div>
                                                )}
                                            </motion.button>
                                        );})}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* SMS Conversations Tab */}
                        <div className="overflow-y-auto px-4" style={{ display: activeTab === "sms" ? "block" : "none", flex: activeTab === "sms" ? 1 : "none" }}>
                            {loadingSmsConversations ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : smsConversations.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col items-center gap-3 text-center py-8 px-4 border border-dashed rounded-lg bg-muted/30"
                                >
                                    <Phone className="h-10 w-10 text-muted-foreground/50" />
                                    <div>
                                        <p className="font-medium text-foreground">No SMS conversations</p>
                                        <p className="text-sm text-muted-foreground mt-1">SMS conversations will appear here when guests text your number</p>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="space-y-2 pb-4">
                                    <AnimatePresence mode="popLayout">
                                        {smsConversations.map((conv, index) => (
                                            <motion.button
                                                key={conv.conversationId}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ delay: index * 0.02, duration: 0.2 }}
                                                layout
                                                onClick={() => handleSelectSmsConversation(conv)}
                                                className={cn(
                                                    "w-full text-left p-3 rounded-lg transition-all duration-200 relative group",
                                                    selectedSmsConversationId === conv.conversationId
                                                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                                                        : conv.unreadCount > 0
                                                        ? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                                                        : "hover:bg-muted border border-transparent hover:border-border"
                                                )}
                                            >
                                                {conv.unreadCount > 0 && (
                                                    <motion.div
                                                        layoutId={`unread-sms-${conv.conversationId}`}
                                                        className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 rounded-l-lg"
                                                    />
                                                )}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="font-medium truncate flex items-center gap-2 text-foreground">
                                                        {conv.guestName || conv.phoneNumber || "Unknown"}
                                                    </div>
                                                    {conv.unreadCount > 0 && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        >
                                                            <Badge variant="destructive" className="ml-2 flex-shrink-0">
                                                                {conv.unreadCount}
                                                            </Badge>
                                                        </motion.div>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground truncate">
                                                    {conv.phoneNumber}
                                                </div>
                                                {conv.lastMessagePreview && (
                                                    <div className="text-sm text-muted-foreground truncate mt-1">
                                                        {conv.lastMessageDirection === "outbound" && <span className="font-medium">You: </span>}
                                                        {conv.lastMessagePreview}
                                                    </div>
                                                )}
                                                {conv.lastMessageAt && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                                                    </div>
                                                )}
                                            </motion.button>
                                        ))}
                                    </AnimatePresence>
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
                    {activeTab === "sms" ? (
                        selectedSmsConversation && selectedSmsMessages ? (
                            <>
                                <CardHeader className="border-b">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Phone className="h-5 w-5" />
                                                {selectedSmsConversation.guestName || selectedSmsConversation.phoneNumber || "Unknown"}
                                            </CardTitle>
                                            <CardDescription>{selectedSmsConversation.phoneNumber} • {selectedSmsConversation.messageCount} messages</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>

                                <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                                    <div className="space-y-4">
                                        {selectedSmsMessages.messages.length === 0 ? (
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground py-4 border border-dashed rounded-md bg-muted/30">
                                                <MessageSquare className="h-8 w-8 opacity-50" />
                                                <p>No messages yet</p>
                                            </div>
                                        ) : (
                                            <AnimatePresence mode="popLayout">
                                                {selectedSmsMessages.messages.map((msg, index) => {
                                                    const isOutbound = msg.direction === "outbound";
                                                    return (
                                                        <motion.div
                                                            key={msg.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.02, duration: 0.2 }}
                                                            className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                                                        >
                                                            <div
                                                                className={`max-w-[85%] sm:max-w-[65%] rounded-lg p-3 ${isOutbound
                                                                    ? "bg-primary text-primary-foreground"
                                                                    : "bg-muted"
                                                                }`}
                                                            >
                                                                {/* Reservation badge if linked */}
                                                                {msg.reservation && (
                                                                    <Link
                                                                        href={`/reservations/${msg.reservation.id}`}
                                                                        className={cn(
                                                                            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded mb-1.5",
                                                                            isOutbound
                                                                                ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                                                                                : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
                                                                        )}
                                                                    >
                                                                        <Tent className="h-3 w-3" />
                                                                        Site {msg.reservation.site?.siteNumber || "—"} • {format(new Date(msg.reservation.arrivalDate), "MMM d")}
                                                                    </Link>
                                                                )}
                                                                <div className="text-sm whitespace-pre-wrap">{msg.body}</div>
                                                                <div
                                                                    className={`flex items-center gap-1 mt-1 text-xs ${isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                                                                >
                                                                    <Clock className="h-3 w-3" />
                                                                    {format(new Date(msg.createdAt), "h:mm a")}
                                                                    {isOutbound && msg.status === "sent" && (
                                                                        <CheckCheck className="h-3 w-3 ml-1 text-emerald-400" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Type an SMS..."
                                            value={newSmsMessage}
                                            onChange={(e) => setNewSmsMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendSmsReply()}
                                            className="transition-all focus:ring-2 focus:ring-primary/20"
                                        />
                                        <Button
                                            onClick={handleSendSmsReply}
                                            disabled={sendingSms || !newSmsMessage.trim()}
                                        >
                                            {sendingSms ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Select an SMS conversation</p>
                                    <p className="text-sm">Choose a conversation to view messages</p>
                                </div>
                            </div>
                        )
                    ) : activeTab === "team" ? (
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
                                    <div className="flex items-center gap-2">
                                        <Badge variant={selectedConversation.status === "checked_in" ? "default" : "secondary"}>
                                            {selectedConversation.status.replace("_", " ")}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowGuestInfo(!showGuestInfo)}
                                            className="hidden lg:flex items-center gap-1"
                                        >
                                            <User className="h-4 w-4" />
                                            {showGuestInfo ? "Hide" : "Show"} Info
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Messages Area */}
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                                        <div className="space-y-4">
                                            <AnimatePresence mode="popLayout">
                                                {selectedConversation.messages.map((msg, index) => {
                                                    const isStaff = msg.senderType === "staff";
                                                    const badgeClasses = isStaff
                                                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                                        : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
                                                    return (
                                                    <motion.div
                                                        key={msg.id}
                                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        transition={{ delay: index * 0.02, duration: 0.2 }}
                                                        className={`flex ${isStaff ? "justify-end" : "justify-start"}`}
                                                    >
                                                        <motion.div
                                                            whileHover={{ scale: 1.01 }}
                                                            className={`max-w-[85%] sm:max-w-[65%] rounded-lg p-3 ${isStaff
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
                                                                    <motion.div
                                                                        initial={{ scale: 0 }}
                                                                        animate={{ scale: 1 }}
                                                                        transition={{ delay: 0.3, type: "spring" }}
                                                                    >
                                                                        <CheckCheck className="h-3 w-3 ml-1 text-emerald-400" />
                                                                    </motion.div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    </motion.div>
                                                );})}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    <div className="p-4 border-t">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Type a message..."
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                                                className="transition-all focus:ring-2 focus:ring-primary/20"
                                            />
                                            <Button
                                                onClick={handleSendMessage}
                                                disabled={sending || !newMessage.trim()}
                                                className="relative overflow-hidden"
                                            >
                                                <AnimatePresence mode="wait">
                                                    {sendSuccess ? (
                                                        <motion.div
                                                            key="success"
                                                            initial={{ scale: 0, rotate: -180 }}
                                                            animate={{ scale: 1, rotate: 0 }}
                                                            exit={{ scale: 0 }}
                                                            transition={{ duration: 0.3, type: "spring" }}
                                                        >
                                                            <CheckCheck className="h-4 w-4" />
                                                        </motion.div>
                                                    ) : sending ? (
                                                        <motion.div
                                                            key="loading"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                        >
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div
                                                            key="send"
                                                            initial={{ x: 0 }}
                                                            whileHover={{ x: 2 }}
                                                            transition={{ duration: 0.15 }}
                                                        >
                                                            <Send className="h-4 w-4" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </Button>
                                        </div>
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>

                                {/* Guest Info Sidebar */}
                                <AnimatePresence>
                                    {showGuestInfo && (
                                        <motion.div
                                            initial={{ width: 0, opacity: 0 }}
                                            animate={{ width: 280, opacity: 1 }}
                                            exit={{ width: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="hidden lg:block border-l bg-muted/30 overflow-hidden"
                                        >
                                            <div className="w-[280px] p-4 space-y-4 overflow-y-auto h-full">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-semibold text-sm">Guest Details</h3>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => setShowGuestInfo(false)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Guest Contact */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <User className="h-5 w-5 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium truncate">{selectedConversation.guestName}</p>
                                                            <p className="text-xs text-muted-foreground">Guest</p>
                                                        </div>
                                                    </div>

                                                    {selectedConversation.guestEmail && (
                                                        <a
                                                            href={`mailto:${selectedConversation.guestEmail}`}
                                                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                                                        >
                                                            <Mail className="h-4 w-4" />
                                                            <span className="truncate flex-1">{selectedConversation.guestEmail}</span>
                                                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                        </a>
                                                    )}

                                                    {selectedConversation.guestPhone && (
                                                        <a
                                                            href={`tel:${selectedConversation.guestPhone}`}
                                                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                                                        >
                                                            <Phone className="h-4 w-4" />
                                                            <span>{selectedConversation.guestPhone}</span>
                                                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Reservation Details */}
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reservation</h4>

                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                                            <span>{selectedConversation.siteName}</span>
                                                            {selectedConversation.siteType && (
                                                                <Badge variant="outline" className="text-[10px] px-1.5">
                                                                    {selectedConversation.siteType}
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {selectedConversation.arrivalDate && selectedConversation.departureDate && (
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                <span>
                                                                    {format(new Date(selectedConversation.arrivalDate), "MMM d")} - {format(new Date(selectedConversation.departureDate), "MMM d, yyyy")}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {(selectedConversation.adults || selectedConversation.children) && (
                                                            <div className="flex items-center gap-2">
                                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                                <span>
                                                                    {selectedConversation.adults || 0} Adult{(selectedConversation.adults || 0) !== 1 ? "s" : ""}
                                                                    {selectedConversation.children ? `, ${selectedConversation.children} Child${selectedConversation.children !== 1 ? "ren" : ""}` : ""}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {selectedConversation.pets !== null && selectedConversation.pets > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <PawPrint className="h-4 w-4 text-muted-foreground" />
                                                                <span>{selectedConversation.pets} Pet{selectedConversation.pets !== 1 ? "s" : ""}</span>
                                                            </div>
                                                        )}

                                                        {selectedConversation.totalAmountCents !== null && (
                                                            <div className="flex items-center gap-2">
                                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                                <span className="font-medium">
                                                                    ${(selectedConversation.totalAmountCents / 100).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Notes */}
                                                {selectedConversation.notes && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</h4>
                                                        <p className="text-sm text-muted-foreground bg-background rounded-lg p-3 border">
                                                            {selectedConversation.notes}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Quick Actions */}
                                                <div className="space-y-2 pt-2">
                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</h4>
                                                    <div className="space-y-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full justify-start"
                                                            onClick={() => window.open(`/reservations/${selectedConversation.reservationId}`, '_blank')}
                                                        >
                                                            <ExternalLink className="h-4 w-4 mr-2" />
                                                            View Reservation
                                                        </Button>
                                                        {selectedConversation.guestId && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start"
                                                                onClick={() => window.open(`/guests/${selectedConversation.guestId}`, '_blank')}
                                                            >
                                                                <User className="h-4 w-4 mr-2" />
                                                                View Guest Profile
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
            {/* Compose Message Dialog */}
            <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PenSquare className="h-5 w-5" />
                            Compose Message
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Message Type Toggle */}
                        <div className="space-y-2">
                            <Label>Message Type</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={composeType === "message" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setComposeType("message")}
                                    className="flex items-center gap-2"
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    Message
                                </Button>
                                <Button
                                    type="button"
                                    variant={composeType === "email" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setComposeType("email")}
                                    className="flex items-center gap-2"
                                >
                                    <Mail className="h-4 w-4" />
                                    Email
                                </Button>
                                <Button
                                    type="button"
                                    variant={composeType === "sms" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setComposeType("sms")}
                                    className="flex items-center gap-2"
                                >
                                    <Phone className="h-4 w-4" />
                                    SMS
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {composeType === "message" && "Sends to the guest's portal inbox (requires a reservation)"}
                                {composeType === "email" && "Sends an email to the guest's email address"}
                                {composeType === "sms" && "Sends a text message to the guest's phone"}
                            </p>
                        </div>

                        {/* Guest Search/Selection */}
                        <div className="space-y-2">
                            <Label>To (Guest)</Label>
                            {composeSelectedGuest ? (
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{composeSelectedGuest.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {composeType === "message"
                                                    ? `${composeSelectedGuest.reservations?.length || 0} reservation(s)`
                                                    : composeType === "email"
                                                    ? (composeSelectedGuest.email || "No email")
                                                    : (composeSelectedGuest.phone || "No phone")}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                            setComposeSelectedGuest(null);
                                            setComposeSelectedReservation(null);
                                            setComposeGuestSearch("");
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search guests by name..."
                                        value={composeGuestSearch}
                                        onChange={(e) => setComposeGuestSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                    {searchedGuests.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg z-50 max-h-48 overflow-y-auto">
                                            {searchedGuests.map((guest: any) => (
                                                <button
                                                    key={guest.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 transition-colors"
                                                    onClick={() => {
                                                        // Get reservations from conversations for this guest
                                                        const guestReservations = conversations
                                                            .filter(c => c.guestId === guest.id)
                                                            .map(c => ({
                                                                id: c.reservationId,
                                                                siteName: c.siteName,
                                                                arrivalDate: c.arrivalDate || "",
                                                                status: c.status
                                                            }));
                                                        setComposeSelectedGuest({
                                                            id: guest.id,
                                                            name: `${guest.primaryFirstName || ""} ${guest.primaryLastName || ""}`.trim() || "Unknown Guest",
                                                            email: guest.email || undefined,
                                                            phone: guest.phone || undefined,
                                                            reservations: guestReservations.length > 0 ? guestReservations : guest.reservations?.map((r: any) => ({
                                                                id: r.id,
                                                                siteName: r.site?.siteNumber || "Unknown Site",
                                                                arrivalDate: r.arrivalDate,
                                                                status: r.status || "confirmed"
                                                            })) || []
                                                        });
                                                        setComposeSelectedReservation(null);
                                                        setComposeGuestSearch("");
                                                    }}
                                                >
                                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-sm truncate">
                                                            {guest.primaryFirstName} {guest.primaryLastName}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {guest.email || guest.phone || "No contact info"}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {searchedGuests.length === 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg z-50 p-4 text-center text-sm text-muted-foreground">
                                            {composeGuestSearch ? `No guests found for "${composeGuestSearch}"` : "No guests found"}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Reservation Selection (for in-app messages) */}
                        {composeType === "message" && composeSelectedGuest && (
                            <div className="space-y-2">
                                <Label>Reservation</Label>
                                {composeSelectedGuest.reservations && composeSelectedGuest.reservations.length > 0 ? (
                                    <div className="space-y-2">
                                        {composeSelectedGuest.reservations.map((res) => (
                                            <button
                                                key={res.id}
                                                type="button"
                                                onClick={() => setComposeSelectedReservation(res)}
                                                className={cn(
                                                    "w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3",
                                                    composeSelectedReservation?.id === res.id
                                                        ? "border-primary bg-primary/5"
                                                        : "hover:bg-muted"
                                                )}
                                            >
                                                <Tent className="h-4 w-4 text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm">{res.siteName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {res.arrivalDate ? format(new Date(res.arrivalDate), "MMM d, yyyy") : "No date"} • {res.status}
                                                    </p>
                                                </div>
                                                {composeSelectedReservation?.id === res.id && (
                                                    <CheckCheck className="h-4 w-4 text-primary" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-lg border border-dashed bg-muted/30 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            This guest has no reservations. Use Email or SMS instead.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Subject (email only) */}
                        {composeType === "email" && (
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Input
                                    placeholder="Email subject..."
                                    value={composeSubject}
                                    onChange={(e) => setComposeSubject(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Message Body */}
                        <div className="space-y-2">
                            <Label>Message</Label>
                            <Textarea
                                placeholder={composeType === "email" ? "Write your email..." : "Write your SMS (160 chars recommended)..."}
                                value={composeBody}
                                onChange={(e) => setComposeBody(e.target.value)}
                                rows={composeType === "email" ? 6 : 3}
                                className="resize-none"
                            />
                            {composeType === "sms" && (
                                <p className="text-xs text-muted-foreground text-right">
                                    {composeBody.length} / 160 characters
                                    {composeBody.length > 160 && (
                                        <span className="text-amber-600 ml-1">(will be split into multiple messages)</span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsComposeOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleComposeSubmit}
                            disabled={
                                composeSending ||
                                !composeSelectedGuest ||
                                !composeBody.trim() ||
                                (composeType === "email" && !composeSubject.trim()) ||
                                (composeType === "message" && !composeSelectedReservation)
                            }
                            className="flex items-center gap-2"
                        >
                            {composeSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            {composeSending ? "Sending..." : "Send"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
