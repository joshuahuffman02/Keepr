"use client";

import { useEffect, useState } from "react";
import { Activity, Server, Database, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

type HealthCheck = {
    name: string;
    status: "healthy" | "degraded" | "down";
    latency?: number;
    message?: string;
    lastChecked: Date;
};

function getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("campreserv:authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const StatusIcon = ({ status }: { status: HealthCheck["status"] }) => {
    switch (status) {
        case "healthy":
            return <CheckCircle className="h-5 w-5 text-emerald-400" />;
        case "degraded":
            return <AlertTriangle className="h-5 w-5 text-amber-400" />;
        case "down":
            return <XCircle className="h-5 w-5 text-red-400" />;
    }
};

const statusColors: Record<string, string> = {
    healthy: "bg-emerald-500/20 border-emerald-500/30",
    degraded: "bg-amber-500/20 border-amber-500/30",
    down: "bg-red-500/20 border-red-500/30",
};

export default function SystemHealthPage() {
    const [checks, setChecks] = useState<HealthCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const runHealthChecks = async () => {
        setLoading(true);
        const results: HealthCheck[] = [];

        // API Health Check
        try {
            const start = Date.now();
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/health`, {
                headers: getAuthHeaders(),
                signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - start;
            results.push({
                name: "API Server",
                status: res.ok ? "healthy" : "degraded",
                latency,
                message: res.ok ? `Responding in ${latency}ms` : `Status: ${res.status}`,
                lastChecked: new Date(),
            });
        } catch (err: any) {
            results.push({
                name: "API Server",
                status: "down",
                message: err.message || "Connection failed",
                lastChecked: new Date(),
            });
        }

        // Database (via API)
        try {
            const start = Date.now();
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/campgrounds?limit=1`, {
                headers: getAuthHeaders(),
                signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - start;
            results.push({
                name: "Database",
                status: res.ok ? "healthy" : "degraded",
                latency,
                message: res.ok ? `Query in ${latency}ms` : `Status: ${res.status}`,
                lastChecked: new Date(),
            });
        } catch (err: any) {
            results.push({
                name: "Database",
                status: "down",
                message: err.message || "Query failed",
                lastChecked: new Date(),
            });
        }

        // Auth Service
        try {
            const start = Date.now();
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/auth/me`, {
                headers: getAuthHeaders(),
                signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - start;
            // 200 = logged in, 401/403 = not logged in, 404 = endpoint may not exist but server is responding
            // All of these mean the auth service is working
            const isResponding = res.status < 500;
            results.push({
                name: "Auth Service",
                status: isResponding ? "healthy" : "degraded",
                latency,
                message: res.ok
                    ? `Authenticated (${latency}ms)`
                    : `Response in ${latency}ms`,
                lastChecked: new Date(),
            });
        } catch (err: any) {
            results.push({
                name: "Auth Service",
                status: "down",
                message: err.message || "Auth check failed",
                lastChecked: new Date(),
            });
        }

        // Local Storage
        try {
            const token = localStorage.getItem("campreserv:authToken");
            results.push({
                name: "Local Storage",
                status: "healthy",
                message: token ? "Auth token present" : "No auth token (logged out?)",
                lastChecked: new Date(),
            });
        } catch {
            results.push({
                name: "Local Storage",
                status: "down",
                message: "Storage unavailable",
                lastChecked: new Date(),
            });
        }

        setChecks(results);
        setLastRefresh(new Date());
        setLoading(false);
    };

    useEffect(() => {
        runHealthChecks();
        const interval = setInterval(runHealthChecks, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const overallStatus = checks.some((c) => c.status === "down")
        ? "down"
        : checks.some((c) => c.status === "degraded")
            ? "degraded"
            : "healthy";

    const avgLatency = Math.round(
        checks.filter((c) => c.latency).reduce((sum, c) => sum + (c.latency || 0), 0) /
        (checks.filter((c) => c.latency).length || 1)
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">System Health</h1>
                    <p className="text-slate-400 mt-1">
                        Real-time status of platform services
                    </p>
                </div>
                <button
                    onClick={runHealthChecks}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Checking..." : "Refresh"}
                </button>
            </div>

            {/* Overall Status */}
            <div className={`rounded-lg border p-6 ${statusColors[overallStatus]}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <StatusIcon status={overallStatus} />
                        <div>
                            <div className="text-lg font-semibold text-white">
                                {overallStatus === "healthy" && "All Systems Operational"}
                                {overallStatus === "degraded" && "Partial System Degradation"}
                                {overallStatus === "down" && "System Outage Detected"}
                            </div>
                            <div className="text-sm text-slate-400">
                                {checks.filter((c) => c.status === "healthy").length} of {checks.length} services healthy
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white">{avgLatency}ms</div>
                        <div className="text-sm text-slate-400">Avg Response</div>
                    </div>
                </div>
            </div>

            {/* Individual Checks */}
            <div className="grid gap-4 md:grid-cols-2">
                {checks.map((check) => (
                    <div
                        key={check.name}
                        className="bg-slate-800 rounded-lg border border-slate-700 p-4"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                {check.name === "API Server" && <Server className="h-5 w-5 text-slate-400" />}
                                {check.name === "Database" && <Database className="h-5 w-5 text-slate-400" />}
                                {check.name === "Auth Service" && <Activity className="h-5 w-5 text-slate-400" />}
                                {check.name === "Local Storage" && <Clock className="h-5 w-5 text-slate-400" />}
                                <div>
                                    <div className="font-medium text-white">{check.name}</div>
                                    <div className="text-sm text-slate-400">{check.message}</div>
                                </div>
                            </div>
                            <StatusIcon status={check.status} />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                            <span>Last checked: {check.lastChecked.toLocaleTimeString()}</span>
                            {check.latency && <span>{check.latency}ms</span>}
                        </div>
                    </div>
                ))}
            </div>

            {lastRefresh && (
                <div className="text-sm text-slate-500 text-center">
                    Last refreshed: {lastRefresh.toLocaleTimeString()} • Auto-refreshes every 30s
                </div>
            )}
        </div>
    );
}
