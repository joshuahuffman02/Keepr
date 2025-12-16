"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, X, Send, Bot, User, Sparkles } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    recommendations?: { siteName: string; siteClassName: string; reasons: string[] }[];
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const chatMutation = useMutation({
        mutationFn: async (message: string) => {
            const res = await fetch(`${API_BASE}/ai/public/campgrounds/${campgroundId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, message }),
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
            };
            setMessages((prev) => [...prev, assistantMessage]);
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
        chatMutation.mutate(input.trim());
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
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
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-[9999]"
                aria-label="Open AI booking assistant"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <Bot className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-semibold">Booking Assistant</div>
                        <div className="text-xs text-white/80">Powered by AI</div>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Consent Screen */}
            {!hasConsented && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">AI Booking Assistant</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        I can help you find the perfect campsite. Just describe what you're looking for!
                    </p>
                    <div className="text-xs text-slate-500 mb-6 p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</span>
                            <span>Your data stays private</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</span>
                            <span>No personal info shared with AI</span>
                        </div>
                    </div>
                    <button
                        onClick={handleConsent}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all"
                    >
                        Start Chatting
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
                                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-emerald-600" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[75%] p-3 rounded-2xl ${msg.role === "user"
                                        ? "bg-emerald-500 text-white rounded-br-md"
                                        : "bg-slate-100 text-slate-900 rounded-bl-md"
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                                    {msg.recommendations && msg.recommendations.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {msg.recommendations.map((rec, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-white rounded-lg p-2 border border-slate-200"
                                                >
                                                    <div className="font-medium text-sm text-slate-900">{rec.siteClassName}</div>
                                                    <div className="text-xs text-slate-500">{rec.reasons.join(" • ")}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-slate-600" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {chatMutation.isPending && (
                            <div className="flex gap-3 justify-start">
                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div className="bg-slate-100 rounded-2xl rounded-bl-md p-3">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-slate-200">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Describe what you're looking for..."
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                                disabled={chatMutation.isPending}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || chatMutation.isPending}
                                className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
