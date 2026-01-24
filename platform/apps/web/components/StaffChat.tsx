"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Send, MessageSquare, X, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InternalMessage {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: {
    firstName: string;
    lastName: string;
  };
}

const fetchMessages = async (): Promise<InternalMessage[]> => {
  const res = await fetch("/api/internal-messages?limit=50");
  return res.json();
};

export function StaffChat() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["internal-messages"],
    queryFn: fetchMessages,
    enabled: isOpen,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await fetch("/api/internal-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["internal-messages"] });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  if (!session?.user) return null;

  if (!isOpen) {
    return (
      <Button
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "fixed bottom-4 right-4 w-80 shadow-xl z-50 transition-all duration-200",
        isMinimized ? "h-14" : "h-[500px]",
      )}
    >
      <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0 bg-primary text-primary-foreground rounded-t-lg">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Staff Chat
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 hover:bg-primary-foreground/20 text-primary-foreground px-0"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 hover:bg-primary-foreground/20 text-primary-foreground px-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(100%-3.5rem)]">
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages?.map((msg) => {
                const isMe = msg.senderId === session.user?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[80%] text-sm",
                      isMe ? "ml-auto items-end" : "mr-auto items-start",
                    )}
                  >
                    <span className="text-xs text-muted-foreground mb-1">
                      {msg.sender.firstName}
                    </span>
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        isMe ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
