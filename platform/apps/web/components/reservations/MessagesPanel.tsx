"use client";

import { useEffect, useState, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

type Message = {
  id: string;
  campgroundId: string;
  senderType: "guest" | "staff";
  content: string;
  readAt: string | null;
  createdAt: string;
  guest: {
    id: string;
    primaryFirstName: string;
    primaryLastName: string;
  };
};

interface MessagesPanelProps {
  reservationId: string;
  guestId: string;
}

export function MessagesPanel({ reservationId, guestId }: MessagesPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    loadMessages();
  }, [reservationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Mark guest messages as read when viewing
    if (messages.some((m) => m.senderType === "guest" && !m.readAt)) {
      apiClient.markMessagesAsRead(reservationId, "staff").catch((error) => {
        console.error("Failed to mark messages as read:", error);
        toast({
          title: "Error",
          description: "Failed to mark messages as read",
          variant: "destructive",
        });
      });
    }
  }, [messages, reservationId, toast]);

  const loadMessages = async () => {
    try {
      const data = await apiClient.getReservationMessages(reservationId);
      setMessages(data);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await apiClient.sendReservationMessage(reservationId, newMessage.trim(), "staff", guestId);
      setNewMessage("");
      await loadMessages();
      toast({
        title: "Success",
        description: "Message sent successfully",
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleGenerateReply = async () => {
    setGeneratingAI(true);
    try {
      const guestMsgs = messages.filter((m) => m.senderType === "guest");
      const lastMsg = guestMsgs[guestMsgs.length - 1];
      const name = lastMsg
        ? `${lastMsg.guest.primaryFirstName} ${lastMsg.guest.primaryLastName}`
        : "Guest";
      const content = lastMsg ? lastMsg.content : "";

      // We need a campgroundId. Often it's in the reservation context, but here we only have IDs.
      // However, MessagesPanel messages contain `campgroundId`.
      const campgroundId = messages[0]?.campgroundId;
      if (!campgroundId) {
        console.warn("No campground ID found in messages");
        toast({
          title: "Error",
          description: "Cannot generate reply: missing campground information",
          variant: "destructive",
        });
        setGeneratingAI(false);
        return;
      }

      const res = await apiClient.runCopilot({
        campgroundId,
        action: "draft_reply",
        payload: {
          guestName: name,
          lastMessage: content,
          reservationContext: "Reservation ID: " + reservationId,
        },
      });

      if (res.preview) {
        setNewMessage(res.preview);
        toast({
          title: "Success",
          description: "AI reply generated successfully",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Failed to generate AI reply:", error);
      toast({
        title: "Error",
        description: "Failed to generate AI reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const unreadCount = messages.filter((m) => m.senderType === "guest" && !m.readAt).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[400px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Guest Messages
          </span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} unread
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === "staff" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    msg.senderType === "staff" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {msg.senderType === "guest" && (
                    <p className="text-xs font-medium mb-0.5">
                      {msg.guest.primaryFirstName} {msg.guest.primaryLastName}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.senderType === "staff"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    {msg.senderType === "staff" && " • Staff"}
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
            placeholder="Reply to guest..."
            disabled={sending}
            className="flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateReply}
            disabled={sending || generatingAI || messages.length === 0}
            title="Generate reply with AI"
          >
            {generatingAI ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-purple-600" />
            )}
          </Button>
          <Button size="sm" onClick={handleSend} disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
