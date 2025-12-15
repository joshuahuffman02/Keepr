"use client";

import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Calendar } from "lucide-react";

type Incident = Awaited<ReturnType<typeof apiClient.createIncident>>;
type Guest = { id: string; primaryFirstName?: string; primaryLastName?: string; email?: string };
type Reservation = { id: string; arrivalDate?: string; departureDate?: string; guest?: Guest; site?: { name?: string } };

export default function IncidentsPage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  // Guest/Reservation search states
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guestSearch, setGuestSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [showReservationDropdown, setShowReservationDropdown] = useState(false);

  const [form, setForm] = useState({
    type: "injury",
    severity: "",
    notes: "",
    reservationId: "",
    guestId: "",
  });

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [claimId, setClaimId] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [coiUrl, setCoiUrl] = useState("");
  const [coiExpiry, setCoiExpiry] = useState("");

  // Selected display names
  const selectedGuest = useMemo(() => guests.find(g => g.id === form.guestId), [guests, form.guestId]);
  const selectedReservation = useMemo(() => reservations.find(r => r.id === form.reservationId), [reservations, form.reservationId]);

  // Filtered lists
  const filteredGuests = useMemo(() => {
    if (!guestSearch.trim()) return guests.slice(0, 10);
    const q = guestSearch.toLowerCase();
    return guests.filter(g => {
      const name = `${g.primaryFirstName || ""} ${g.primaryLastName || ""}`.toLowerCase();
      return name.includes(q) || (g.email || "").toLowerCase().includes(q);
    }).slice(0, 10);
  }, [guests, guestSearch]);

  const filteredReservations = useMemo(() => {
    if (!reservationSearch.trim()) return reservations.slice(0, 10);
    const q = reservationSearch.toLowerCase();
    return reservations.filter(r => {
      const guestName = `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.toLowerCase();
      const siteName = (r.site?.name || "").toLowerCase();
      return guestName.includes(q) || siteName.includes(q) || r.id.toLowerCase().includes(q);
    }).slice(0, 10);
  }, [reservations, reservationSearch]);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const camps = await apiClient.getCampgrounds();
        const cg = camps[0];
        if (cg?.id) {
          setCampgroundId(cg.id);
          const [list, guestList, resList] = await Promise.all([
            apiClient.listIncidents(cg.id),
            apiClient.getGuests().catch(() => []),
            apiClient.getReservations(cg.id).catch(() => [])
          ]);
          setIncidents(list as Incident[]);
          setGuests(guestList as Guest[]);
          setReservations(resList as Reservation[]);
          if (list.length) setSelectedIncidentId(list[0].id);
        }
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const submitIncident = async () => {
    if (!campgroundId) return;
    const created = await apiClient.createIncident({
      campgroundId,
      type: form.type,
      severity: form.severity || undefined,
      notes: form.notes || undefined,
      reservationId: form.reservationId || undefined,
      guestId: form.guestId || undefined,
    });
    setIncidents([created as Incident, ...incidents]);
    setSelectedIncidentId(created.id);
    setForm({ ...form, notes: "" });
  };

  const attachEvidence = async () => {
    if (!selectedIncidentId || !evidenceUrl) return;
    await apiClient.addIncidentEvidence(selectedIncidentId, { url: evidenceUrl, type: "photo" });
    setEvidenceUrl("");
  };

  const linkClaim = async () => {
    if (!selectedIncidentId || !claimId) return;
    const updated = await apiClient.linkIncidentClaim(selectedIncidentId, { claimId });
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? (updated as Incident) : i)));
    setClaimId("");
  };

  const setReminder = async () => {
    if (!selectedIncidentId || !reminderAt) return;
    const updated = await apiClient.setIncidentReminder(selectedIncidentId, { reminderAt });
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? (updated as Incident) : i)));
  };

  const addTask = async () => {
    if (!selectedIncidentId || !taskTitle) return;
    await apiClient.createIncidentTask(selectedIncidentId, { title: taskTitle });
    setTaskTitle("");
  };

  const closeIncident = async () => {
    if (!selectedIncidentId) return;
    const updated = await apiClient.closeIncident(selectedIncidentId, { resolutionNotes: "Closed from UI stub" });
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? (updated as Incident) : i)));
  };

  const attachCoi = async () => {
    if (!selectedIncidentId || !coiUrl) return;
    await apiClient.attachIncidentCoi(selectedIncidentId, {
      fileUrl: coiUrl,
      expiresAt: coiExpiry || undefined,
    });
    setCoiUrl("");
    setCoiExpiry("");
  };

  const fetchReport = async () => {
    if (!campgroundId) return;
    const summary = await apiClient.getIncidentReport(campgroundId, "json");
    setReport(summary);
  };

  return (
    <DashboardShell title="Incidents" subtitle="Log incidents, evidence, COIs, and follow-up tasks">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New Incident</CardTitle>
            <CardDescription>Create and link to reservations or guests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="flex flex-col gap-1">
              <span>Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="border rounded px-2 py-1"
              >
                <option value="injury">Injury</option>
                <option value="property_damage">Property Damage</option>
                <option value="safety">Safety</option>
                <option value="near_miss">Near Miss</option>
                <option value="environmental">Environmental</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>Severity</span>
              <Input value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} placeholder="low | med | high | critical" />
            </label>
            <label className="flex flex-col gap-1">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="border rounded px-2 py-1"
                rows={3}
              />
            </label>
            {/* Reservation Selector */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                Reservation
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by guest name or site..."
                  value={form.reservationId ? `${selectedReservation?.guest?.primaryFirstName || ""} ${selectedReservation?.guest?.primaryLastName || ""} (${selectedReservation?.site?.name || "Site"})` : reservationSearch}
                  onChange={(e) => {
                    setReservationSearch(e.target.value);
                    setForm({ ...form, reservationId: "" });
                    setShowReservationDropdown(true);
                  }}
                  onFocus={() => setShowReservationDropdown(true)}
                  className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {form.reservationId && (
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, reservationId: "" }); setReservationSearch(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >×</button>
                )}
              </div>
              {showReservationDropdown && !form.reservationId && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredReservations.length > 0 ? filteredReservations.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, reservationId: r.id, guestId: r.guest?.id || form.guestId });
                        setShowReservationDropdown(false);
                        setReservationSearch("");
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 text-sm border-b last:border-b-0"
                    >
                      <div className="font-medium">{r.guest?.primaryFirstName} {r.guest?.primaryLastName}</div>
                      <div className="text-xs text-slate-500">{r.site?.name} · {r.arrivalDate?.slice(0, 10)} → {r.departureDate?.slice(0, 10)}</div>
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-sm text-slate-500">No reservations found</div>
                  )}
                </div>
              )}
            </div>

            {/* Guest Selector */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">
                <User className="inline h-4 w-4 mr-1" />
                Guest
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={form.guestId ? `${selectedGuest?.primaryFirstName || ""} ${selectedGuest?.primaryLastName || ""}` : guestSearch}
                  onChange={(e) => {
                    setGuestSearch(e.target.value);
                    setForm({ ...form, guestId: "" });
                    setShowGuestDropdown(true);
                  }}
                  onFocus={() => setShowGuestDropdown(true)}
                  className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {form.guestId && (
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, guestId: "" }); setGuestSearch(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >×</button>
                )}
              </div>
              {showGuestDropdown && !form.guestId && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredGuests.length > 0 ? filteredGuests.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, guestId: g.id });
                        setShowGuestDropdown(false);
                        setGuestSearch("");
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 text-sm border-b last:border-b-0"
                    >
                      <div className="font-medium">{g.primaryFirstName} {g.primaryLastName}</div>
                      <div className="text-xs text-slate-500">{g.email}</div>
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-sm text-slate-500">No guests found</div>
                  )}
                </div>
              )}
            </div>
            <Button onClick={submitIncident} disabled={loading || !campgroundId}>Create Incident</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incident Actions</CardTitle>
            <CardDescription>Attach evidence, link claims, reminders, COIs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex flex-col gap-1">
              <span>Incident</span>
              <select
                value={selectedIncidentId}
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="" disabled>
                  {incidents.length ? "Select incident" : "No incidents yet"}
                </option>
                {incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.type} · {i.status}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Evidence URL" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
              <Button variant="outline" onClick={attachEvidence} disabled={!selectedIncidentId}>
                Upload Evidence
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Claim ID" value={claimId} onChange={(e) => setClaimId(e.target.value)} />
              <Button variant="outline" onClick={linkClaim} disabled={!selectedIncidentId}>
                Link Claim
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
              <Button variant="outline" onClick={setReminder} disabled={!selectedIncidentId}>
                Set Reminder
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Follow-up task" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <Button variant="outline" onClick={addTask} disabled={!selectedIncidentId}>
                Add Task
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="COI file URL" value={coiUrl} onChange={(e) => setCoiUrl(e.target.value)} />
              <Input type="date" value={coiExpiry} onChange={(e) => setCoiExpiry(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={attachCoi} disabled={!selectedIncidentId}>
                Attach COI
              </Button>
              <Button variant="destructive" onClick={closeIncident} disabled={!selectedIncidentId}>
                Close Incident
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open Incidents</CardTitle>
            <CardDescription>Lightweight list to validate API wiring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incidents.length === 0 && <p className="text-sm text-muted-foreground">No incidents captured yet.</p>}
            {incidents.map((incident) => (
              <div key={incident.id} className="border rounded p-3">
                <div className="flex justify-between">
                  <div className="font-semibold">{incident.type}</div>
                  <span className="text-xs uppercase text-muted-foreground">{incident.status}</span>
                </div>
                <p className="text-sm">{incident.notes || "No notes"}</p>
                <div className="text-xs text-muted-foreground space-x-2">
                  {incident.claimId && <span>Claim: {incident.claimId}</span>}
                  {incident.reminderAt && <span>Reminder: {incident.reminderAt}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Reporting</CardTitle>
              <CardDescription>Pull basic incident/export summary.</CardDescription>
            </div>
            <Button variant="outline" onClick={fetchReport} disabled={!campgroundId}>
              Refresh report
            </Button>
          </CardHeader>
          <CardContent>
            {report ? (
              <div className="space-y-2 text-sm">
                <div className="font-semibold">By Status</div>
                {report.byStatus?.map((s: any) => (
                  <div key={s.status} className="flex justify-between">
                    <span>{s.status}</span>
                    <span>{s._count._all}</span>
                  </div>
                ))}
                <div className="font-semibold pt-2">By Type</div>
                {report.byType?.map((t: any) => (
                  <div key={t.type} className="flex justify-between">
                    <span>{t.type}</span>
                    <span>{t._count._all}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <span>Open tasks</span>
                  <span>{report.openTasks}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No report yet. Click refresh.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
