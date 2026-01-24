"use client";

import { useState, useEffect } from "react";
import { Megaphone, Send, Clock, CheckCircle, Users, Plus, X, RefreshCw } from "lucide-react";

type AnnouncementType = "info" | "warning" | "success";
type AnnouncementTarget = "all" | "admins" | "campground";

type Announcement = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  message: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  campgroundId: string | null;
  status: "draft" | "scheduled" | "sent";
  scheduledAt: string | null;
  sentAt: string | null;
  createdByEmail: string | null;
};

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("campreserv:authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const typeColors = {
  info: "bg-status-info/15 text-status-info border-status-info/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  success: "bg-status-success/15 text-status-success border-status-success/30",
};

const toAnnouncementType = (value: string): AnnouncementType => {
  if (value === "warning" || value === "success" || value === "info") return value;
  return "info";
};

const toAnnouncementTarget = (value: string): AnnouncementTarget => {
  if (value === "admins" || value === "campground" || value === "all") return value;
  return "all";
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState<{
    title: string;
    message: string;
    type: AnnouncementType;
    target: AnnouncementTarget;
  }>({
    title: "",
    message: "",
    type: "info",
    target: "all",
  });

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/admin/announcements`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to load announcements (${res.status})`);
      const data: Announcement[] = await res.json();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message) return;
    setCreating(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/admin/announcements`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newAnnouncement),
      });
      if (!res.ok) throw new Error(`Failed to create announcement`);
      const created: Announcement = await res.json();
      setAnnouncements([created, ...announcements]);
      setNewAnnouncement({ title: "", message: "", type: "info", target: "all" });
      setShowNew(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create announcement");
    } finally {
      setCreating(false);
    }
  };

  const sendNow = async (id: string) => {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/admin/announcements/${id}/send`, {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to send announcement`);
      const updated: Announcement = await res.json();
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send announcement");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Announcements</h1>
          <p className="text-muted-foreground mt-1">
            Broadcast messages to staff across all campgrounds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAnnouncements}
            disabled={loading}
            className="p-2 bg-muted text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowNew(!showNew)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Announcement
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-status-error/15 border border-status-error/30 rounded-lg p-4 text-status-error">
          {error}
        </div>
      )}

      {/* New Announcement Form */}
      {showNew && (
        <div className="bg-muted rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Create Announcement</h2>
            <button
              onClick={() => setShowNew(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Title</label>
              <input
                type="text"
                value={newAnnouncement.title}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Announcement title"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-muted-foreground mb-1">Type</label>
                <select
                  value={newAnnouncement.type}
                  onChange={(e) => {
                    const value = toAnnouncementType(e.target.value);
                    setNewAnnouncement({ ...newAnnouncement, type: value });
                  }}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm text-muted-foreground mb-1">Target</label>
                <select
                  value={newAnnouncement.target}
                  onChange={(e) => {
                    const value = toAnnouncementTarget(e.target.value);
                    setNewAnnouncement({ ...newAnnouncement, target: value });
                  }}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Staff</option>
                  <option value="admins">Admins Only</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Message</label>
            <textarea
              value={newAnnouncement.message}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your announcement message..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowNew(false)}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newAnnouncement.title || !newAnnouncement.message || creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create Draft"}
            </button>
          </div>
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {loading && announcements.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Loading announcements...</div>
        )}
        {!loading && announcements.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No announcements yet. Create one to get started.
          </div>
        )}
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className={`rounded-lg border p-4 ${typeColors[announcement.type]}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Megaphone className="h-5 w-5 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{announcement.title}</span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        announcement.status === "sent"
                          ? "bg-emerald-500/30"
                          : announcement.status === "scheduled"
                            ? "bg-blue-500/30"
                            : "bg-muted0/30"
                      }`}
                    >
                      {announcement.status}
                    </span>
                  </div>
                  <p className="text-sm mt-1 opacity-90">{announcement.message}</p>
                  <div className="flex items-center gap-4 text-xs mt-2 opacity-70">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {announcement.target === "all" ? "All Staff" : "Admins Only"}
                    </span>
                    <span>by {announcement.createdByEmail || "unknown"}</span>
                    {announcement.sentAt && (
                      <span>Sent {new Date(announcement.sentAt).toLocaleDateString()}</span>
                    )}
                    {announcement.scheduledAt && announcement.status === "scheduled" && (
                      <span>
                        Scheduled for {new Date(announcement.scheduledAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {announcement.status === "draft" && (
                <button
                  onClick={() => sendNow(announcement.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-card/10 hover:bg-card/20 rounded-lg text-sm transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Send Now
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-muted-foreground text-center">
        Showing {announcements.length} announcements
      </div>
    </div>
  );
}
