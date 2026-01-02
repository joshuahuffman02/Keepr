"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, X, Send, Bot, User, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    recommendations?: { siteName: string; siteClassName: string; reasons: string[] }[];
    clarifyingQuestions?: string[];
}

interface AiChatWidgetProps {
    campgroundId: string;
    campgroundName?: string;
}

function generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function AiChatWidget({ campgroundId, campgroundName }: AiChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sessionId] = useState(() => generateSessionId());
    const [hasConsented, setHasConsented] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const chatMutation = useMutation({
        mutationFn: async ({ message, history }: { message: string; history: { role: 'user' | 'assistant'; content: string }[] }) => {
            const res = await fetch(`${API_BASE}/ai/public/campgrounds/${campgroundId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    message,
                    history
                }),
            });
            if (!res.ok) throw new Error("Failed to send message");
            return res.json();
        },
        onSuccess: (data) => {
            const assistantMessage: Message = {
                id: `msg_${Date.now()}`,
                role: "assistant",
                content: data.message,
                recommendations: data.recommendations,
                clarifyingQuestions: data.clarifyingQuestions || data.questions || [],
            };
            setMessages((prev) => [...prev, assistantMessage]);

            // Handle booking action
            // Always redirect if action is 'book', filling whatever details we have
            if (data.action === 'book') {
                console.log("AI triggered booking action:", data.bookingDetails);
                const params = new URLSearchParams(window.location.search);

                if (data.bookingDetails?.dates) {
                    params.set('arrivalDate', data.bookingDetails.dates.arrival);
                    params.set('departureDate', data.bookingDetails.dates.departure);
                }
                if (data.bookingDetails?.partySize) {
                    params.set('adults', data.bookingDetails.partySize.adults.toString());
                    params.set('children', data.bookingDetails.partySize.children.toString());
                    // Combined guests param for V2 client
                    params.set('guests', (data.bookingDetails.partySize.adults + data.bookingDetails.partySize.children).toString());
                }
                if (data.bookingDetails?.rigInfo) {
                    params.set('rvLength', data.bookingDetails.rigInfo.length.toString());
                    params.set('rvType', data.bookingDetails.rigInfo.type);
                    // Infer siteType for the filter dropdown
                    params.set('siteType', 'rv');
                }
                if (data.bookingDetails?.siteClassId) {
                    params.set('siteClassId', data.bookingDetails.siteClassId);
                }

                // If no rig info but we have site class, we might want to infer siteType?
                // For now, defaulting to 'rv' if rig info is present is safe.

                // Use Next.js router for soft navigation to prevent clearing chat state
                // This updates the URL params which the parent page watches to pre-fill the form
                // Redirect to the booking page with pre-filled parameters
                const baseUrl = `${window.location.pathname}/book`;
                const newUrl = `${baseUrl}?${params.toString()}`;
                console.log("Redirecting to:", newUrl);
                router.push(newUrl);

                // Optional: If we want to actually navigate to a different page (like /book), use router
                // But for now, we assume we want to stay on the page and just fill the form.
                // If the user IS meant to go to a booking page, we should check the current path.
            }
        },
        onError: () => {
            setMessages((prev) => [
                ...prev,
                {
                    id: `msg_${Date.now()}`,
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again.",
                },
            ]);
        },
    });

    const handleSend = () => {
        if (!input.trim() || chatMutation.isPending) return;

        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            role: "user",
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Prepare history for API (excluding the message we just added optimistically)
        const history = messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        }));

        chatMutation.mutate({ message: input.trim(), history });
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleQuickReply = (question: string) => {
        setInput(question);
        inputRef.current?.focus();
    };

    const handleConsent = () => {
        setHasConsented(true);
        setMessages([
            {
                id: "welcome",
                role: "assistant",
                content: `Hi! I'm here to help you find the perfect campsite at ${campgroundName || "our park"}. What are you looking for? You can tell me about your dates, RV size, or what amenities you need.`,
            },
        ]);
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-action-primary text-action-primary-foreground rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-[9999]"
                aria-label="Open Host booking assistant"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-border">
            {/* Header */}
            <div className="bg-action-primary text-action-primary-foreground p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-card/20 rounded-full flex items-center justify-center">
                        <Bot className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-semibold">Host</div>
                        <div className="text-xs text-white/80">Booking guide</div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-card/10 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Consent Screen */}
            {!hasConsented && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-status-success-bg rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-status-success-text" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Host</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        I can help you find the perfect campsite. Just describe what you're looking for.
                    </p>
                    <div className="text-xs text-muted-foreground mb-6 p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-4 h-4 bg-status-success rounded-full flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                            <span>Your data stays private</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-status-success rounded-full flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                            <span>No personal info shared with Host</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleConsent}
                        className="px-6 py-3 bg-action-primary text-action-primary-foreground font-medium rounded-xl hover:bg-action-primary-hover transition-all"
                    >
                        Chat with Host
                    </button>
                </div>
            )}

            {/* Messages */}
            {hasConsented && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="w-8 h-8 bg-status-success-bg rounded-full flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-status-success-text" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[75%] p-3 rounded-2xl ${msg.role === "user"
                                        ? "bg-action-primary text-action-primary-foreground rounded-br-md"
                                        : "bg-muted text-foreground rounded-bl-md"
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                                    {msg.clarifyingQuestions && msg.clarifyingQuestions.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick answers</div>
                                            <div className="flex flex-wrap gap-2">
                                                {msg.clarifyingQuestions.map((question, idx) => (
                                                    <button
                                                        key={`${question}-${idx}`}
                                                        type="button"
                                                        onClick={() => handleQuickReply(question)}
                                                        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-action-primary/40 hover:text-action-primary"
                                                    >
                                                        {question}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {msg.recommendations && msg.recommendations.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended site classes</div>
                                            {msg.recommendations.map((rec, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-card rounded-lg p-2 border border-border"
                                                >
                                                    <div className="font-medium text-sm text-foreground">{rec.siteClassName}</div>
                                                    <div className="text-xs text-muted-foreground">{rec.reasons.join(" • ")}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {chatMutation.isPending && (
                            <div className="flex gap-3 justify-start">
                                <div className="w-8 h-8 bg-status-success-bg rounded-full flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-status-success-text" />
                                </div>
                                <div className="bg-muted rounded-2xl rounded-bl-md p-3">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:0.1s]" />
                                        <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:0.2s]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-border">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Describe what you're looking for..."
                                className="flex-1 px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-action-primary/20 focus:border-action-primary text-sm"
                                disabled={chatMutation.isPending}
                                ref={inputRef}
                            />
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={!input.trim() || chatMutation.isPending}
                                className="p-2 bg-action-primary text-action-primary-foreground rounded-xl hover:bg-action-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
