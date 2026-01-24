"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { BookingMap, MapSite } from "@/components/maps/BookingMap";
import {
  loadQueue as loadQueueGeneric,
  saveQueue as saveQueueGeneric,
  registerBackgroundSync,
} from "@/lib/offline-queue";
import { randomId } from "@/lib/random-id";
import { TableEmpty } from "@/components/ui/table";

type Reservation = Awaited<ReturnType<typeof apiClient.getCampgroundReservations>>[number];
type ReservationWithCampground = Reservation & {
  campground?: { name?: string | null } | null;
};
type ReservationMessage = Awaited<ReturnType<typeof apiClient.getReservationMessages>>[number];
type SiteStatusData = Awaited<ReturnType<typeof apiClient.getSitesWithStatus>>[number];
type Campground = Awaited<ReturnType<typeof apiClient.getCampground>>;

type Stay = {
  id: string;
  campground: string;
  campgroundId?: string;
  guestId?: string;
  site: string;
  arrivalDate: string;
  departureDate: string;
  balance: number;
  status: string;
};

type EventItem = {
  id: string;
  name: string;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
};

type Message = Pick<ReservationMessage, "id" | "content" | "senderType" | "createdAt">;

type QueuedMessage = {
  id: string;
  reservationId: string;
  guestId: string;
  content: string;
  createdAt: string;
  attempt: number;
  nextAttemptAt: number;
  lastError?: string | null;
  conflict?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getOptionalString = (value: unknown, key: string) => {
  if (!isRecord(value)) return null;
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return "Something went wrong";
};

const getErrorStatus = (error: unknown) => {
  if (!isRecord(error)) return null;
  const status = error.status;
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    const parsed = Number(status);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export default function GuestPwaPage() {
  const [stay, setStay] = useState<Stay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [lastPayRequest, setLastPayRequest] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [queued, setQueued] = useState<number>(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<QueuedMessage[]>([]);
  const [siteStatus, setSiteStatus] = useState<SiteStatusData[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [campgroundCenter, setCampgroundCenter] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // reuse reservations endpoint; pick the most recent upcoming/active reservation
        const emptyReservations: ReservationWithCampground[] = [];
        const reservations: ReservationWithCampground[] = apiClient.getCampgroundReservations
          ? await apiClient.getCampgroundReservations().catch(() => emptyReservations)
          : emptyReservations;
        if (!isMounted) return;
        const candidate = reservations.find((reservation) => reservation.status !== "cancelled");
        if (candidate) {
          const campgroundValue = isRecord(candidate) ? candidate.campground : null;
          const campgroundName =
            isRecord(campgroundValue) && typeof campgroundValue.name === "string"
              ? campgroundValue.name
              : (candidate.campgroundId ?? "Your campground");
          setStay({
            id: candidate.id,
            campground: campgroundName,
            campgroundId: candidate.campgroundId,
            guestId: candidate.guestId,
            site: candidate.site?.name ?? "Your site",
            arrivalDate: candidate.arrivalDate,
            departureDate: candidate.departureDate,
            balance: candidate.balanceAmount ?? 0,
            status: candidate.status,
          });
        } else {
          setStay(null);
        }
      } catch (error) {
        if (!isMounted) return;
        const message = getErrorMessage(error);
        setError(message || "Failed to load your stay");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load events for the stay's campground
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!stay?.campgroundId) return;
      setEventsLoading(true);
      try {
        const start = new Date().toISOString();
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(); // next 14 days
        const data = await apiClient.getEvents(stay.campgroundId, start, end);
        if (!isMounted) return;
        setEvents(
          data.map((event) => {
            const name = getOptionalString(event, "name") ?? event.title ?? "Event";
            const startAt =
              getOptionalString(event, "startAt") ??
              event.startDate ??
              getOptionalString(event, "start") ??
              "";
            const endAt =
              getOptionalString(event, "endAt") ?? event.endDate ?? getOptionalString(event, "end");
            return {
              id: event.id,
              name,
              startAt,
              endAt,
              location: event.location ?? null,
            };
          }),
        );
      } catch {
        if (!isMounted) return;
        setEvents([]);
      } finally {
        if (!isMounted) return;
        setEventsLoading(false);
      }
    };
    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [stay?.campgroundId]);

  // Load messages
  useEffect(() => {
    let isMounted = true;
    const loadMessages = async () => {
      if (!stay?.id) return;
      try {
        const data = await apiClient.getReservationMessages(stay.id);
        if (!isMounted) return;
        setMessages(
          data
            .slice(-10)
            .map((message) => ({
              id: message.id,
              content: message.content,
              senderType: message.senderType,
              createdAt: message.createdAt,
            }))
            .reverse(),
        );
      } catch {
        if (!isMounted) return;
        setMessages([]);
      }
    };
    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [stay?.id]);

  // Offline queue helpers with backoff metadata
  const queueKey = useMemo(() => "campreserv:pwa:queuedMessages", []);
  const loadQueue = (): QueuedMessage[] => loadQueueGeneric<QueuedMessage>(queueKey);
  const saveQueue = (items: QueuedMessage[]) => {
    saveQueueGeneric(queueKey, items);
    setQueued(items.length);
    setConflicts(items.filter((i) => i.conflict));
    void registerBackgroundSync();
  };

  useEffect(() => {
    const list = loadQueue();
    setQueued(list.length);
    setConflicts(list.filter((i) => i.conflict));
    if (typeof window !== "undefined") {
      setLastSync(localStorage.getItem("campreserv:pwa:lastMessageSync"));
    }
  }, [queueKey]);

  // Map data for the current stay
  useEffect(() => {
    const load = async () => {
      if (!stay?.campgroundId || !stay.arrivalDate || !stay.departureDate) return;
      setMapLoading(true);
      try {
        const emptySiteStatus: SiteStatusData[] = [];
        const statusPromise = apiClient
          .getSitesWithStatus(stay.campgroundId, {
            arrivalDate: stay.arrivalDate,
            departureDate: stay.departureDate,
          })
          .catch(() => emptySiteStatus);
        const campgroundPromise = apiClient.getCampground
          ? apiClient.getCampground(stay.campgroundId).catch(() => null)
          : Promise.resolve<Campground | null>(null);
        const [statusData, campground] = await Promise.all([statusPromise, campgroundPromise]);
        setSiteStatus(statusData);
        if (campground) {
          setCampgroundCenter({
            latitude: typeof campground.latitude === "number" ? campground.latitude : null,
            longitude: typeof campground.longitude === "number" ? campground.longitude : null,
          });
        }
      } finally {
        setMapLoading(false);
      }
    };
    load();
  }, [stay?.campgroundId, stay?.arrivalDate, stay?.departureDate]);

  const flushQueue = async () => {
    const now = Date.now();
    const items = loadQueue();
    if (!items.length || !navigator.onLine) return;
    const remaining: QueuedMessage[] = [];
    for (const item of items) {
      if (item.nextAttemptAt && item.nextAttemptAt > now) {
        remaining.push(item);
        continue;
      }
      try {
        await apiClient.sendReservationMessage(
          item.reservationId,
          item.content,
          "guest",
          item.guestId,
        );
      } catch (error) {
        const attempt = (item.attempt ?? 0) + 1;
        const delay = Math.min(300000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
        const message = getErrorMessage(error);
        const status = getErrorStatus(error);
        const isConflict = status === 409 || status === 412 || /conflict/i.test(message);
        remaining.push({
          ...item,
          attempt,
          nextAttemptAt: Date.now() + delay,
          lastError: message,
          conflict: isConflict,
        });
        recordTelemetry({
          source: "guest-pwa",
          type: isConflict ? "conflict" : "error",
          status: isConflict ? "conflict" : "failed",
          message: isConflict ? "Message conflict, needs review" : "Message retry scheduled",
          meta: { error: message },
        });
      }
    }
    saveQueue(remaining);
    if (!remaining.length) {
      const stamp = new Date().toISOString();
      setLastSync(stamp);
      if (typeof window !== "undefined") {
        localStorage.setItem("campreserv:pwa:lastMessageSync", stamp);
      }
      recordTelemetry({
        source: "guest-pwa",
        type: "sync",
        status: "success",
        message: "Guest messages queue flushed",
        meta: { flushed: items.length },
      });
    }
  };

  useEffect(() => {
    if (navigator.onLine) {
      void flushQueue();
    }
    if (typeof window !== "undefined") {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "SYNC_QUEUES") {
          void flushQueue();
        }
      };
      navigator.serviceWorker?.addEventListener("message", handler);
      return () => navigator.serviceWorker?.removeEventListener("message", handler);
    }
  }, [navigator.onLine]);

  const sendMessage = async (content: string) => {
    if (!stay?.id || !stay?.guestId) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      if (!navigator.onLine) {
        const queuedItem: QueuedMessage = {
          id: randomId(),
          reservationId: stay.id,
          guestId: stay.guestId,
          content: trimmed,
          createdAt: new Date().toISOString(),
          attempt: 0,
          nextAttemptAt: Date.now(),
          lastError: null,
          conflict: false,
        };
        const updated = [...loadQueue(), queuedItem];
        saveQueue(updated);
        await registerBackgroundSync();
        recordTelemetry({
          source: "guest-pwa",
          type: "queue",
          status: "pending",
          message: "Message queued offline",
          meta: { reservationId: stay.id },
        });
      } else {
        await apiClient.sendReservationMessage(stay.id, trimmed, "guest", stay.guestId);
        const newMessage: Message = {
          id: randomId(),
          content: trimmed,
          senderType: "guest",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [newMessage, ...prev].slice(0, 12));
        recordTelemetry({
          source: "guest-pwa",
          type: "sync",
          status: "success",
          message: "Message sent online",
          meta: { reservationId: stay.id },
        });
      }
      setMessageInput("");
      setOrderNote("");
      setPaying(false);
      await flushQueue();
    } catch (error) {
      const queuedItem: QueuedMessage = {
        id: randomId(),
        reservationId: stay.id,
        guestId: stay.guestId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        attempt: 0,
        nextAttemptAt: Date.now(),
        lastError: null,
        conflict: false,
      };
      const updated = [...loadQueue(), queuedItem];
      saveQueue(updated);
      const message = getErrorMessage(error);
      setError(message || "Saved to send later");
      recordTelemetry({
        source: "guest-pwa",
        type: "error",
        status: "failed",
        message: "Send failed, queued for retry",
        meta: { error: message },
      });
    } finally {
      setSending(false);
    }
  };

  const retryConflict = (id: string) => {
    const items = loadQueue().map((i) =>
      i.id === id ? { ...i, conflict: false, nextAttemptAt: Date.now() } : i,
    );
    saveQueue(items);
    void flushQueue();
  };

  const discardConflict = (id: string) => {
    const items = loadQueue().filter((i) => i.id !== id);
    saveQueue(items);
  };

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  const mapSites: MapSite[] = useMemo(() => {
    const baseLatitude =
      typeof campgroundCenter.latitude === "number" ? campgroundCenter.latitude : null;
    const baseLongitude =
      typeof campgroundCenter.longitude === "number" ? campgroundCenter.longitude : null;
    return (siteStatus || []).map((site, idx) => ({
      id: site.id,
      name: site.name,
      siteNumber: site.siteNumber || "",
      status: site.status,
      latitude:
        site.latitude ?? (baseLatitude !== null ? baseLatitude + 0.0004 * Math.sin(idx) : null),
      longitude:
        site.longitude ?? (baseLongitude !== null ? baseLongitude + 0.0004 * Math.cos(idx) : null),
    }));
  }, [siteStatus, campgroundCenter]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-4 space-y-4">
      <header className="pwa-card p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Guest PWA</div>
          <h1 className="text-xl font-semibold text-slate-50">My Stay</h1>
          <p className="text-slate-400 text-sm">
            Quick access to your reservation, site, and balance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {offline && <Badge variant="outline">Offline</Badge>}
          {queued > 0 && (
            <Badge
              variant="secondary"
              title={
                conflicts.length
                  ? `${queued - conflicts.length} queued, ${conflicts.length} conflicts${conflicts[0]?.lastError ? ` (last error: ${conflicts[0].lastError})` : ""}${
                      queued > conflicts.length
                        ? ` • next retry ${new Date(
                            Math.min(
                              ...loadQueue()
                                .map((i) => i.nextAttemptAt)
                                .filter((n) => typeof n === "number"),
                            ),
                          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : ""
                    }`
                  : `${queued} queued`
              }
            >
              {queued} queued
            </Badge>
          )}
          {conflicts.length > 0 && (
            <Badge variant="destructive">{conflicts.length} conflicts</Badge>
          )}
          {lastSync && (
            <Badge variant="outline">
              Last sync{" "}
              {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/pwa/sync-log">Sync log</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Exit</Link>
          </Button>
        </div>
      </header>

      {error && <div className="pwa-card p-3 text-sm text-red-100 border-red-500">{error}</div>}

      {loading ? (
        <div className="pwa-card p-4 text-sm text-slate-300">Loading…</div>
      ) : !stay ? (
        <div className="pwa-card p-4 text-sm text-slate-300">No active stay found.</div>
      ) : (
        <div className="space-y-3">
          <div className="pwa-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {stay.campground}
                </div>
                <h2 className="text-lg font-semibold">{stay.site}</h2>
              </div>
              <Badge variant="outline" className="capitalize">
                {stay.status}
              </Badge>
            </div>
            <div className="text-sm text-slate-200">
              {stay.arrivalDate ? new Date(stay.arrivalDate).toLocaleDateString() : ""} →{" "}
              {stay.departureDate ? new Date(stay.departureDate).toLocaleDateString() : ""}
            </div>
            <div className="text-sm text-emerald-200">
              Balance: ${(stay.balance / 100).toFixed(2)}
            </div>
          </div>

          <div className="pwa-card p-4 space-y-2">
            <div className="text-sm font-semibold">Actions</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/park/map">View map</Link>
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => sendMessage(messageInput || "Hi, I need help with my stay.")}
                disabled={sending || !stay?.guestId}
              >
                Message office
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  sendMessage(
                    orderNote
                      ? `ORDER REQUEST: ${orderNote}`
                      : "ORDER REQUEST: Please contact me for an order.",
                  )
                }
                disabled={sending || !stay?.guestId}
              >
                Order to site
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={sending || paying || !stay?.guestId}
                onClick={async () => {
                  if (!stay) return;
                  setPaying(true);
                  const msg = `PAYMENT REQUEST: Please send me a payment link. Balance: $${(stay.balance / 100).toFixed(2)}`;
                  await sendMessage(msg);
                  setLastPayRequest(new Date().toISOString());
                  setPaying(false);
                }}
              >
                {paying ? "Queuing..." : "Pay balance"}
              </Button>
            </div>
            <div className="space-y-2">
              <Textarea
                placeholder="Type a message to the office..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="bg-slate-950/40 border-slate-800"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => sendMessage(messageInput)}
                  disabled={sending || !stay?.guestId}
                >
                  Send
                </Button>
                <span className="text-xs text-slate-400">
                  {offline ? "Will send when online." : "Sends immediately."}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Order to site</div>
              <Input
                placeholder="Ice, firewood, bundle, etc."
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                className="bg-slate-950/40 border-slate-800"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  sendMessage(
                    orderNote
                      ? `ORDER REQUEST: ${orderNote}`
                      : "ORDER REQUEST: Please contact me for an order.",
                  )
                }
                disabled={sending || !stay?.guestId}
              >
                Send order request
              </Button>
            </div>

            {offline && (
              <div className="text-xs text-slate-400">
                Actions queue if offline and will retry automatically.
              </div>
            )}
            {lastPayRequest && (
              <div className="text-xs text-emerald-200">
                Payment request sent{" "}
                {new Date(lastPayRequest).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                . We’ll text/email you a link.
              </div>
            )}
          </div>

          {mapSites.length > 0 && (
            <div className="pwa-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Map</div>
                  <div className="text-sm font-semibold">Your park map (beta)</div>
                </div>
                <Badge variant="outline">{mapSites.length} sites</Badge>
              </div>
              <BookingMap
                sites={mapSites}
                campgroundCenter={campgroundCenter}
                selectedSiteId={undefined}
                isLoading={mapLoading}
              />
              <div className="text-xs text-slate-400">
                Pins show availability for your dates. Colors: green = available, amber = occupied,
                red = maintenance/blackout.
              </div>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="pwa-card p-4 space-y-2 border border-amber-400/60">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-400">Conflicts</div>
                  <div className="text-sm font-semibold">Queued messages need attention</div>
                </div>
                <Badge variant="destructive">{conflicts.length}</Badge>
              </div>
              <div className="space-y-2">
                {conflicts.map((c) => (
                  <div
                    key={c.id}
                    className="rounded border border-amber-300 bg-amber-50/10 p-2 flex items-center justify-between gap-2"
                  >
                    <div className="text-xs text-amber-100 truncate">
                      {c.content.slice(0, 60)}
                      {c.content.length > 60 ? "…" : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => retryConflict(c.id)}>
                        Retry
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => discardConflict(c.id)}>
                        Discard
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pwa-card p-4 space-y-2">
            <div className="text-sm font-semibold">Messages</div>
            {messages.length === 0 ? (
              <div className="overflow-hidden rounded border border-slate-800 bg-slate-900/50">
                <table className="w-full text-xs">
                  <tbody>
                    <TableEmpty>No messages yet.</TableEmpty>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 p-2"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="capitalize">{m.senderType}</span>
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-sm text-slate-100 whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pwa-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Events</div>
              <Badge variant="outline">{events.length}</Badge>
            </div>
            {eventsLoading ? (
              <div className="text-xs text-slate-400">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="overflow-hidden rounded border border-slate-800 bg-slate-900/50">
                <table className="w-full text-xs">
                  <tbody>
                    <TableEmpty>No upcoming events.</TableEmpty>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 p-2"
                  >
                    <div className="text-sm font-semibold text-slate-100">{ev.name}</div>
                    <div className="text-xs text-slate-400">
                      {ev.startAt ? new Date(ev.startAt).toLocaleString() : ""}
                      {ev.endAt
                        ? ` – ${new Date(ev.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </div>
                    {ev.location && <div className="text-xs text-slate-300">{ev.location}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
