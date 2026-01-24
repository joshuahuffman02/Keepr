"use client";

import { useEffect, useState, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { format } from "date-fns";

type Message = {
  id: string;
  senderType: "guest" | "staff";
  content: string;
  createdAt: string;
  guest: {
    id: string;
    primaryFirstName: string;
    primaryLastName: string;
  };
};

interface GuestChatPanelProps {
  reservationId: string;
  token: string;
}

// Polling interval in milliseconds (3 seconds)
const POLL_INTERVAL = 3000;

export function GuestChatPanel({ reservationId, token }: GuestChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch messages function
  const fetchMessages = async () => {
    try {
      const data = await apiClient.getPortalMessages(reservationId, token);

      // Check if there are new messages from staff (for notification)
      const hasNewStaffMessages =
        data.length > lastMessageCountRef.current &&
        data.slice(lastMessageCountRef.current).some((m: Message) => m.senderType === "staff");

      setMessages(data);

      // Auto-scroll when new messages arrive (not on initial load)
      if (!isInitialLoadRef.current && data.length > lastMessageCountRef.current) {
        scrollToBottom();
      }

      lastMessageCountRef.current = data.length;

      // Play notification sound for new staff messages
      if (hasNewStaffMessages && !isInitialLoadRef.current) {
        try {
          // Simple beep using Web Audio API
          const getAudioContextConstructor = () => {
            if (typeof window.AudioContext === "function") {
              return window.AudioContext;
            }
            if ("webkitAudioContext" in window) {
              const candidate = window.webkitAudioContext;
              if (typeof candidate === "function") {
                return candidate;
              }
            }
            return undefined;
          };
          const AudioContextConstructor = getAudioContextConstructor();
          if (AudioContextConstructor) {
            const audioContext = new AudioContextConstructor();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.type = "sine";
            gainNode.gain.value = 0.1;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
          }
        } catch (e) {
          // Audio not available, ignore
        }
      }

      isInitialLoadRef.current = false;
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and polling
  useEffect(() => {
    // Reset refs when reservation changes
    isInitialLoadRef.current = true;
    lastMessageCountRef.current = 0;
    setLoading(true);

    // Initial fetch
    fetchMessages();

    // Set up polling
    const interval = setInterval(fetchMessages, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [reservationId, token]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && isInitialLoadRef.current === false) {
      // Small delay to ensure DOM is updated
      setTimeout(() => scrollToBottom("instant"), 100);
    }
  }, [loading]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await apiClient.sendPortalMessage(reservationId, newMessage.trim(), token);
      setNewMessage("");
      // Immediately fetch to show the new message
      await fetchMessages();
      scrollToBottom();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Live updates enabled
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Send a message to the front desk</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === "guest" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.senderType === "guest" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.senderType === "guest"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    {msg.senderType === "staff" && " • Front Desk"}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex gap-2 pt-3 border-t">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
