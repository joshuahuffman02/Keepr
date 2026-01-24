import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

export type AbandonedCartEntry = {
  id: string;
  campgroundId: string;
  email?: string | null;
  phone?: string | null;
  channel: "email" | "sms" | "unknown";
  abandonedAt: string;
  lastActivityAt: string;
  status: "queued" | "contacted";
  notes?: string | null;
};

@Injectable()
export class AbandonedCartService {
  private queue: AbandonedCartEntry[] = [];
  private readonly MAX_ENTRIES = 200;

  private normalizeTimestamp(value?: string | null) {
    const d = value ? new Date(value) : new Date();
    return Number.isFinite(d.valueOf()) ? d.toISOString() : new Date().toISOString();
  }

  private deriveChannel(
    email?: string | null,
    phone?: string | null,
  ): AbandonedCartEntry["channel"] {
    if (email) return "email";
    if (phone) return "sms";
    return "unknown";
  }

  record(payload: { campgroundId: string; email?: string; phone?: string; abandonedAt?: string }) {
    const abandonedAt = this.normalizeTimestamp(payload.abandonedAt);
    const lastActivityAt = abandonedAt;
    const channel = this.deriveChannel(payload.email, payload.phone);

    const existing = this.queue.find(
      (entry) =>
        entry.campgroundId === payload.campgroundId &&
        ((payload.email && entry.email === payload.email) ||
          (payload.phone && entry.phone === payload.phone)),
    );

    if (existing) {
      existing.lastActivityAt = this.normalizeTimestamp();
      existing.abandonedAt = existing.abandonedAt || abandonedAt;
      existing.email = existing.email || payload.email || null;
      existing.phone = existing.phone || payload.phone || null;
      existing.channel = existing.channel === "unknown" ? channel : existing.channel;
      existing.status = "queued";
      return existing;
    }

    const entry: AbandonedCartEntry = {
      id: randomUUID(),
      campgroundId: payload.campgroundId,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      channel,
      abandonedAt,
      lastActivityAt,
      status: "queued",
      notes: null,
    };

    this.queue.unshift(entry);
    if (this.queue.length > this.MAX_ENTRIES) {
      this.queue = this.queue.slice(0, this.MAX_ENTRIES);
    }
    return entry;
  }

  list(campgroundId?: string) {
    const filtered = campgroundId
      ? this.queue.filter((q) => q.campgroundId === campgroundId)
      : this.queue;
    return filtered.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }

  markContacted(id: string, note?: string) {
    const entry = this.queue.find((q) => q.id === id);
    if (!entry) return null;
    entry.status = "contacted";
    entry.lastActivityAt = this.normalizeTimestamp();
    entry.notes = note ?? entry.notes ?? null;
    return entry;
  }
}
