"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Bot, Send, User, Sparkles, TrendingUp, DollarSign, Calendar, ArrowLeft, Brain } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type QuickAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  description: string;
};

export default function AiChatPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Get campground from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(stored);
  }, []);

  // Fetch campground details
  const { data: campground } = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: async () => {
      if (!campgroundId) return null;
      const campgrounds = await apiClient.getCampgrounds();
      return campgrounds.find((c) => c.id === campgroundId) || null;
    },
    enabled: !!campgroundId,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0 && campground) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hi! I'm your AI assistant for ${campground.name}. I can help you with:\n\n- Drafting replies to guest messages\n- Getting pricing suggestions based on demand\n- Analyzing occupancy trends and insights\n- Answering questions about your campground data\n\nWhat can I help you with today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages.length, campground]);

  const history = useMemo(
    () => messages.map((msg) => ({ role: msg.role, content: msg.content })),
    [messages]
  );

  // Chat mutation using the copilot endpoint
  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; history: { role: "user" | "assistant"; content: string }[] }) =>
      apiClient.runCopilot({
        campgroundId: campgroundId!,
        action: "chat",
        prompt: payload.message,
        payload: { history: payload.history },
      }),
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data?.preview || "I'm here to help. What would you like to know?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      console.error("AI chat failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending || !campgroundId) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate({ message: trimmed, history });
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const quickActions: QuickAction[] = [
    {
      id: "draft-reply",
      label: "Draft Reply",
      icon: <Send className="h-4 w-4" />,
      prompt: "Draft a friendly reply to a guest asking about late checkout options",
      description: "Generate professional guest responses",
    },
    {
      id: "pricing",
      label: "Pricing Insights",
      icon: <DollarSign className="h-4 w-4" />,
      prompt: "What are the pricing suggestions for next weekend based on current demand?",
      description: "Get rate optimization suggestions",
    },
    {
      id: "occupancy",
      label: "Occupancy Analysis",
      icon: <TrendingUp className="h-4 w-4" />,
      prompt: "Show me occupancy trends and insights for the next 30 days",
      description: "Analyze booking patterns",
    },
  ];

  if (!campgroundId) {
    return (
      <DashboardShell>
        <motion.div
          className="flex min-h-[60vh] items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
        >
          <Card className="max-w-lg border-slate-200 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Select a campground to start using your AI assistant.</p>
              <p className="text-xs text-slate-500">
                The AI can help with guest replies, pricing suggestions, occupancy insights, and more.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING_CONFIG}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/ai">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">AI Chat</h1>
                <p className="text-sm text-muted-foreground">
                  Your intelligent assistant for {campground?.name}
                </p>
              </div>
            </div>
            {campground && (
              <Badge variant="outline" className="text-sm">
                {campground.name}
              </Badge>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.05 }}
        >
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Get started with common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickActions.map((action) => (
                  <motion.button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickAction(action.prompt)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-all",
                      "hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:shadow-md",
                      "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    )}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                        {action.icon}
                      </div>
                      <span className="font-semibold text-foreground">{action.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Chat Interface */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conversation</CardTitle>
              <CardDescription>Chat with your AI assistant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Messages */}
              <div className="h-[500px] overflow-y-auto rounded-xl border border-border bg-background p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p>Start a conversation with your AI assistant</p>
                      <p className="text-xs mt-1">Try asking about pricing, occupancy, or drafting a guest reply</p>
                    </div>
                  )}

                  {messages.map((msg, index) => (
                    <motion.div
                      key={msg.id}
                      className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
                      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={prefersReducedMotion ? undefined : { delay: index * 0.05, ...SPRING_CONFIG }}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 flex-shrink-0">
                          <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                          msg.role === "user"
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                            : "bg-muted text-foreground border border-border"
                        )}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <div
                          className={cn(
                            "mt-2 text-[10px]",
                            msg.role === "user" ? "text-emerald-100" : "text-muted-foreground"
                          )}
                        >
                          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {chatMutation.isPending && (
                    <motion.div
                      className="flex gap-3 justify-start"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50">
                        <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="rounded-2xl bg-muted border border-border px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.1s]" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="rounded-xl border border-border bg-muted p-3 shadow-sm">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about your campground, guests, pricing, or operations..."
                  className="min-h-[100px] bg-background border-border focus:border-emerald-400 focus:ring-emerald-400/20"
                  disabled={chatMutation.isPending}
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Press Enter to send, Shift+Enter for new line
                  </span>
                  <Button
                    size="sm"
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md"
                    onClick={handleSend}
                    disabled={!input.trim() || chatMutation.isPending}
                  >
                    Send
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}
