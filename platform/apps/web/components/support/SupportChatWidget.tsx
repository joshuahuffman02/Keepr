"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, X, Send, Bot, User, Sparkles, LifeBuoy, ExternalLink, Ticket } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  helpArticles?: { title: string; url: string }[];
  showTicketPrompt?: boolean;
}

function generateSessionId() {
  return `support_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hi! I'm here to help with any questions about Camp Everyday. What can I help you with today?\n\nI can assist with:\n- Setting up your campground\n- Payment and billing questions\n- Managing reservations\n- Using specific features\n\nJust ask away!",
        },
      ]);
    }
  }, [isOpen, messages.length]);

  const chatMutation = useMutation({
    mutationFn: async ({
      message,
      history,
    }: {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    }) => {
      const res = await fetch(`${API_BASE}/ai/support/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          sessionId,
          message,
          history,
          context: "dashboard_support",
        }),
      });

      if (!res.ok) {
        // If the support endpoint doesn't exist yet, provide a fallback
        return {
          message:
            "I apologize, but I'm having trouble connecting to the support system right now. Here are some helpful resources:\n\n" +
            "- Check our [Help Center](/help) for answers to common questions\n" +
            "- Browse the [FAQ](/help/faq) section\n" +
            "- [Submit a support ticket](/help/contact) for personalized assistance",
          helpArticles: [
            { title: "Help Center", url: "/help" },
            { title: "FAQs", url: "/help/faq" },
            { title: "Contact Support", url: "/help/contact" },
          ],
          showTicketPrompt: true,
        };
      }
      return res.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.message,
        helpArticles: data.helpArticles,
        showTicketPrompt: data.showTicketPrompt,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I encountered an error. You can still get help by:\n\n" +
            "- Checking our Help Center\n" +
            "- Submitting a support ticket\n" +
            "- Emailing support@campeveryday.com",
          showTicketPrompt: true,
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

    const history = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
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

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-[9999]"
        aria-label="Open support chat"
      >
        <LifeBuoy className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold">Support Assistant</div>
            <div className="text-xs text-white/80">Here to help</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div
              className={`max-w-[75%] p-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-br-md"
                  : "bg-slate-100 text-slate-900 rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Help Articles */}
              {msg.helpArticles && msg.helpArticles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-slate-500">Related articles:</p>
                  {msg.helpArticles.map((article, idx) => (
                    <Link
                      key={idx}
                      href={article.url}
                      className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-200 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {article.title}
                    </Link>
                  ))}
                </div>
              )}

              {/* Ticket Prompt */}
              {msg.showTicketPrompt && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">Need more help?</p>
                  <Link
                    href="/help/contact"
                    className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    <Ticket className="w-4 h-4" />
                    Submit a Ticket
                  </Link>
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
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600" />
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

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto">
        {[
          { label: "Help Center", href: "/help" },
          { label: "FAQs", href: "/help/faq" },
          { label: "Contact", href: "/help/contact" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex-shrink-0 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-slate-200 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            disabled={chatMutation.isPending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
