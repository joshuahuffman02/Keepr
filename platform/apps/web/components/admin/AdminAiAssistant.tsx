"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Lightbulb,
  BarChart3,
  Calendar,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Settings,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  actions?: { label: string; action: string; data?: Record<string, unknown> }[];
}

interface AdminAiAssistantProps {
  /** Current campground ID for context */
  campgroundId?: string;
  /** Campground name for personalization */
  campgroundName?: string;
  /** Position on screen */
  position?: "bottom-right" | "bottom-left";
  /** Custom class for the widget */
  className?: string;
}

// Pre-defined quick prompts for admin tasks
const QUICK_PROMPTS = [
  { icon: BarChart3, label: "Today's stats", prompt: "What are today's key metrics?" },
  { icon: Calendar, label: "Upcoming arrivals", prompt: "Show me today's arrivals" },
  { icon: Lightbulb, label: "Suggestions", prompt: "Any operational suggestions for today?" },
  { icon: HelpCircle, label: "Help", prompt: "What can you help me with?" },
];

// Welcome messages for new sessions
const WELCOME_MESSAGES = [
  "How can I help you manage your campground today?",
  "Ready to assist with your campground operations!",
  "What would you like to know about your campground?",
];

/**
 * AI Assistant widget for campground administrators.
 * Provides operational insights, quick answers, and task assistance.
 *
 * @example
 * <AdminAiAssistant
 *   campgroundId={campgroundId}
 *   campgroundName={campground.name}
 * />
 */
export function AdminAiAssistant({
  campgroundId,
  campgroundName,
  position = "bottom-right",
  className,
}: AdminAiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hi${campgroundName ? ` from ${campgroundName}` : ""}! ${welcomeMessage}`,
          timestamp: new Date(),
          suggestions: [
            "Show me today's occupancy",
            "Any pending check-ins?",
            "Revenue summary for this week",
          ],
        },
      ]);
    }
  }, [isOpen, messages.length, campgroundName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Simulated AI response (replace with actual API call)
  const generateResponse = useCallback(async (userMessage: string): Promise<Message> => {
    // This is a placeholder - in production, this would call your AI API
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

    const lowerMessage = userMessage.toLowerCase();
    let content = "";
    let suggestions: string[] = [];
    let actions: Message["actions"] = [];

    if (lowerMessage.includes("today") && lowerMessage.includes("stat")) {
      content = "Here's a quick overview for today:\n\n" +
        "Arrivals: 8 guests\n" +
        "Departures: 5 guests\n" +
        "Occupancy: 76%\n" +
        "Revenue: $2,450\n\n" +
        "Would you like more details on any of these?";
      suggestions = ["Show arrivals list", "Revenue breakdown", "Site availability"];
      actions = [{ label: "View Dashboard", action: "navigate", data: { path: "/dashboard" } }];
    } else if (lowerMessage.includes("arrival")) {
      content = "You have 8 arrivals scheduled for today:\n\n" +
        "- Smith family (Site A12, 2:00 PM)\n" +
        "- Johnson (Site B5, 3:00 PM)\n" +
        "- Garcia group (Site C8, 1:00 PM)\n" +
        "... and 5 more\n\n" +
        "Would you like me to show the full list?";
      suggestions = ["Full arrivals list", "Print check-in sheets", "Send welcome texts"];
      actions = [{ label: "View Calendar", action: "navigate", data: { path: "/calendar" } }];
    } else if (lowerMessage.includes("suggestion") || lowerMessage.includes("recommend")) {
      content = "Based on today's operations, here are my suggestions:\n\n" +
        "1. Site A15 needs maintenance check (reported yesterday)\n" +
        "2. Consider early check-in for Garcia group (arriving from far)\n" +
        "3. Low on firewood inventory - reorder soon\n" +
        "4. Weather forecast shows rain - prepare wet weather activities\n\n" +
        "Would you like me to help with any of these?";
      suggestions = ["Create maintenance ticket", "Contact Garcia group", "Order supplies"];
    } else if (lowerMessage.includes("help") || lowerMessage.includes("what can you")) {
      content = "I can help you with:\n\n" +
        "Operations: Check-ins, departures, site status\n" +
        "Analytics: Revenue, occupancy, guest stats\n" +
        "Tasks: Maintenance tickets, inventory alerts\n" +
        "Guests: Look up reservations, contact info\n" +
        "Reports: Generate summaries, export data\n\n" +
        "Just ask me anything about your campground!";
      suggestions = ["Today's arrivals", "Revenue this week", "Pending maintenance"];
    } else if (lowerMessage.includes("revenue")) {
      content = "Revenue summary:\n\n" +
        "Today: $2,450\n" +
        "This week: $18,340\n" +
        "This month: $67,890\n\n" +
        "You're up 12% compared to last month. Your RV sites are performing particularly well!";
      suggestions = ["Revenue by site type", "Compare to last year", "Export report"];
    } else {
      content = "I understand you're asking about: \"" + userMessage + "\"\n\n" +
        "Let me help you with that. Could you provide a bit more context? For example:\n" +
        "- Are you looking for today's data?\n" +
        "- Do you need help with a specific guest or reservation?\n" +
        "- Would you like operational suggestions?";
      suggestions = ["Today's overview", "Guest lookup", "Site status"];
    }

    return {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content,
      timestamp: new Date(),
      suggestions,
      actions,
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await generateResponse(input.trim());
      setMessages((prev) => [...prev, response]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    // Auto-send quick prompts
    setTimeout(() => {
      setInput("");
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      generateResponse(prompt).then((response) => {
        setMessages((prev) => [...prev, response]);
        setIsLoading(false);
      });
    }, 0);
  };

  const handleClearChat = () => {
    setMessages([]);
    setIsOpen(false);
    setTimeout(() => setIsOpen(true), 100);
  };

  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-50 w-14 h-14 bg-action-primary text-action-primary-foreground rounded-full shadow-xl hover:shadow-2xl transition-shadow flex items-center justify-center",
          positionClasses[position],
          className
        )}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>
    );
  }

  // Chat window
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={cn(
        "fixed z-50 bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border",
        positionClasses[position],
        isExpanded ? "w-[600px] h-[80vh]" : "w-96 h-[500px]",
        className
      )}
    >
      {/* Header */}
      <div className="bg-action-primary text-action-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-card/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold">AI Assistant</div>
            <div className="text-xs text-action-primary-foreground/80">
              {campgroundName || "Campground Operations"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-action-primary-foreground/80 hover:text-action-primary-foreground hover:bg-card/10"
            onClick={handleClearChat}
            title="Clear chat"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-action-primary-foreground/80 hover:text-action-primary-foreground hover:bg-card/10"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-action-primary-foreground/80 hover:text-action-primary-foreground hover:bg-card/10"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 p-3 bg-muted border-b border-border overflow-x-auto">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => handleQuickPrompt(prompt.prompt)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-full text-xs font-medium text-muted-foreground hover:border-action-primary/40 hover:text-action-primary transition-colors whitespace-nowrap"
          >
            <prompt.icon className="w-3 h-3" />
            {prompt.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-status-info-bg rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-status-info-text" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-2xl",
                  msg.role === "user"
                    ? "bg-action-primary text-action-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {/* Suggestions */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-2 py-1 text-xs bg-card border border-border rounded-full text-muted-foreground hover:border-action-primary/40 hover:text-action-primary transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-status-info-bg rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-status-info-text" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md p-3">
              <div className="flex gap-1">
                <motion.div
                  className="w-2 h-2 bg-status-info rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-status-info rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-status-info rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about operations, guests, revenue..."
            className="flex-1 px-4 py-2 border border-border bg-card rounded-xl focus:outline-none focus:ring-2 focus:ring-action-primary/20 focus:border-action-primary text-sm text-foreground placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
