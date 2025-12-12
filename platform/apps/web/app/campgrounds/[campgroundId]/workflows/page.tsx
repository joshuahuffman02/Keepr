"use client";

import { useEffect, useState } from "react";

type Workflow = {
  id: string;
  name: string;
  trigger: string;
  status: string;
  priority: number;
};

export default function WorkflowsPage({ params }: { params: { campgroundId: string } }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    trigger: "reservation_created",
    priority: 100,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows?campgroundId=${params.campgroundId}`);
      if (!res.ok) throw new Error("Failed to load workflows");
      const data = await res.json();
      setWorkflows(data || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load workflows. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setError(null);
    const res = await fetch(`/api/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campgroundId: params.campgroundId,
        name: form.name,
        trigger: form.trigger,
        priority: Number(form.priority),
      }),
    });
    if (!res.ok) {
      setError("Could not save workflow. Try again.");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6 p-6">
      <div data-testid="workflows-header">
        <h1 className="text-2xl font-semibold">Communication Workflows</h1>
        <p className="text-slate-500">Automations for reservation and payment events.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4" data-testid="workflow-create-card">
          <h2 className="text-lg font-medium mb-2">Create Workflow</h2>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Name</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <label className="block text-sm font-medium">Trigger</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={form.trigger}
              onChange={(e) => setForm({ ...form, trigger: e.target.value })}
            >
              <option value="reservation_created">Reservation Created</option>
              <option value="check_in">Check-in</option>
              <option value="check_out">Check-out</option>
              <option value="payment_received">Payment Received</option>
              <option value="payment_failed">Payment Failed</option>
              <option value="review_received">Review Received</option>
            </select>
            <label className="block text-sm font-medium">Priority</label>
            <input
              type="number"
              className="w-24 rounded border px-3 py-2"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
            <button
              className="mt-2 rounded bg-indigo-600 px-4 py-2 text-white"
              onClick={create}
              data-testid="workflow-trigger-button"
            >
              Save Workflow
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-4" data-testid="workflow-list-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Workflows</h2>
            {loading && <span className="text-sm text-slate-500" data-testid="workflow-loading">Loading…</span>}
          </div>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700" role="alert" aria-live="polite">
              {error}
            </div>
          )}
          <div className="space-y-2" aria-busy={loading}>
            {loading && (
              <div className="space-y-2 animate-pulse" data-testid="workflow-skeleton">
                <div className="h-4 rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
              </div>
            )}
            {!loading &&
              workflows.map((wf) => (
                <div key={wf.id} className="rounded border px-3 py-2 flex justify-between" data-testid="workflow-step-row">
                  <div>
                    <div className="font-semibold">{wf.name}</div>
                    <div className="text-xs text-slate-500">
                      {wf.trigger} · priority {wf.priority}
                    </div>
                  </div>
                  <div className="text-xs text-emerald-700" data-testid="workflow-run-status">{wf.status}</div>
                </div>
              ))}
            {!loading && !workflows.length && <div className="text-sm text-slate-500" data-testid="workflow-empty">No workflows yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

