"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import { apiClient } from "../../../lib/api-client";
import Link from "next/link";

type StoreLocation = Awaited<ReturnType<typeof apiClient.getStoreLocations>>[0];
type FulfillmentOrder = Awaited<ReturnType<typeof apiClient.getFulfillmentQueue>>[0];
type FulfillmentStatus = NonNullable<FulfillmentOrder["fulfillmentStatus"]>;

const STATUS_COLORS: Record<FulfillmentStatus, string> = {
    unassigned: "bg-muted text-muted-foreground border-border",
    assigned: "bg-status-info-bg text-status-info-text border-status-info-border",
    preparing: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
    ready: "bg-status-success-bg text-status-success-text border-status-success-border",
    completed: "bg-status-success-bg text-status-success-text border-status-success-border",
};

const STATUS_LABELS: Record<FulfillmentStatus, string> = {
    unassigned: "Unassigned",
    assigned: "Assigned",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
};

const NEXT_STATUS: Record<FulfillmentStatus, FulfillmentStatus | null> = {
    unassigned: null, // Must assign first
    assigned: "preparing",
    preparing: "ready",
    ready: "completed",
    completed: null,
};

export default function FulfillmentQueuePage() {
    const [campgroundId, setCampgroundId] = useState<string | null>(null);
    const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
    const [locations, setLocations] = useState<StoreLocation[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<FulfillmentStatus | "all">("all");
    const [locationFilter, setLocationFilter] = useState<string | "all">("all");
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<FulfillmentOrder | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
        }
    }, []);

    const loadData = async () => {
        if (!campgroundId) return;
        setLoading(true);
        try {
            const [ordersData, locationsData, countsData] = await Promise.all([
                apiClient.getFulfillmentQueue(campgroundId, {
                    status: statusFilter === "all" ? undefined : statusFilter,
                    locationId: locationFilter === "all" ? undefined : locationFilter,
                }),
                apiClient.getStoreLocations(campgroundId),
                apiClient.getFulfillmentCounts(campgroundId),
            ]);
            setOrders(ordersData);
            setLocations(locationsData.filter((l) => l.acceptsOnline));
            setCounts(countsData);
        } catch (err) {
            console.error("Failed to load fulfillment data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [campgroundId, statusFilter, locationFilter]);

    const handleAssign = async (locationId: string) => {
        if (!selectedOrder) return;
        setAssigning(true);
        try {
            await apiClient.assignOrderToLocation(selectedOrder.id, locationId, campgroundId ?? undefined);
            setAssignDialogOpen(false);
            setSelectedOrder(null);
            await loadData();
        } catch (err) {
            console.error("Failed to assign order:", err);
        } finally {
            setAssigning(false);
        }
    };

    const handleUpdateStatus = async (orderId: string, newStatus: FulfillmentStatus) => {
        setUpdating(orderId);
        try {
            await apiClient.updateFulfillmentStatus(orderId, newStatus, campgroundId ?? undefined);
            await loadData();
        } catch (err) {
            console.error("Failed to update status:", err);
        } finally {
            setUpdating(null);
        }
    };

    const openAssignDialog = (order: FulfillmentOrder) => {
        setSelectedOrder(order);
        setAssignDialogOpen(true);
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    if (!campgroundId) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center h-64 text-slate-500">
                    Please select a campground first.
                </div>
            </DashboardShell>
        );
    }

    const totalActive = (counts.unassigned || 0) + (counts.assigned || 0) + (counts.preparing || 0) + (counts.ready || 0);

    return (
        <DashboardShell>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Fulfillment Queue</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Manage online orders awaiting fulfillment
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => loadData()} disabled={loading}>
                            Refresh
                        </Button>
                        <Button asChild variant="secondary">
                            <Link href="/store/locations">Manage Locations</Link>
                        </Button>
                    </div>
                </div>

                {/* Status Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <button
                        onClick={() => setStatusFilter("all")}
                        className={`p-4 rounded-lg border transition-all ${
                            statusFilter === "all"
                                ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900"
                                : "border-slate-200 hover:border-slate-300"
                        }`}
                    >
                        <div className="text-2xl font-bold text-slate-900">{totalActive}</div>
                        <div className="text-sm text-slate-500">All Active</div>
                    </button>
                    {(["unassigned", "assigned", "preparing", "ready"] as FulfillmentStatus[]).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`p-4 rounded-lg border transition-all ${
                                statusFilter === status
                                    ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900"
                                    : "border-slate-200 hover:border-slate-300"
                            }`}
                        >
                            <div className="text-2xl font-bold text-slate-900">{counts[status] || 0}</div>
                            <div className="text-sm text-slate-500">{STATUS_LABELS[status]}</div>
                        </button>
                    ))}
                </div>

                {/* Filters */}
                {locations.length > 1 && (
                    <div className="flex items-center gap-4">
                        <Label className="text-sm font-medium text-slate-700">Filter by location:</Label>
                        <select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                        >
                            <option value="all">All Locations</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                    {loc.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Order List */}
                {loading ? (
                    <div className="grid gap-4">
                        {[...Array(3)].map((_, i) => (
                            <Card key={i} className="overflow-hidden">
                                <CardContent className="p-4 animate-pulse">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div className="flex-1 space-y-2">
                                            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" />
                                        </div>
                                        <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="text-slate-400 mb-2">
                                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                            </div>
                            <p className="text-slate-600 font-medium">No orders in queue</p>
                            <p className="text-sm text-slate-500 mt-1">
                                {statusFilter !== "all"
                                    ? `No ${STATUS_LABELS[statusFilter].toLowerCase()} orders found.`
                                    : "Online orders will appear here when placed."}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {orders.map((order) => (
                            <Card key={order.id} className="overflow-hidden">
                                <div className="flex">
                                    {/* Order Info */}
                                    <div className="flex-1 p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-slate-900">
                                                        Order #{order.id.slice(0, 8)}
                                                    </span>
                                                    <Badge className={STATUS_COLORS[order.fulfillmentStatus]}>
                                                        {STATUS_LABELS[order.fulfillmentStatus]}
                                                    </Badge>
                                                    {order.fulfillmentLocation && (
                                                        <Badge variant="outline">
                                                            {order.fulfillmentLocation.code || order.fulfillmentLocation.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm text-slate-500 mt-1">
                                                    {order.createdAt ? formatTimeAgo(order.createdAt) : "Just now"}
                                                    {order.promisedAt && (
                                                        <span className="ml-2 text-amber-600 font-medium">
                                                            Promised: {formatTime(order.promisedAt)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg text-slate-900">
                                                    ${(order.totalCents / 100).toFixed(2)}
                                                </div>
                                                {order.fulfillmentType && (
                                                    <div className="text-xs text-slate-500 capitalize">
                                                        {order.fulfillmentType.replace("_", " ")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Customer Info */}
                                        {(order.guest || order.siteNumber) && (
                                            <div className="text-sm text-slate-600 mb-3">
                                                {order.guest && (
                                                    <span>
                                                        {order.guest.firstName} {order.guest.lastName}
                                                        {order.guest.phone && ` - ${order.guest.phone}`}
                                                    </span>
                                                )}
                                                {order.siteNumber && (
                                                    <span className="ml-2 text-slate-500">Site {order.siteNumber}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Items */}
                                        <div className="space-y-1">
                                            {order.items.slice(0, 4).map((item) => (
                                                <div key={item.id} className="flex items-center text-sm">
                                                    <span className="text-slate-600">{item.qty}x</span>
                                                    <span className="ml-2 text-slate-900">{item.name}</span>
                                                </div>
                                            ))}
                                            {order.items.length > 4 && (
                                                <div className="text-xs text-slate-400">
                                                    +{order.items.length - 4} more items
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery Instructions */}
                                        {order.deliveryInstructions && (
                                            <div className="mt-3 p-2 bg-amber-50 rounded-md text-sm text-amber-800">
                                                <span className="font-medium">Notes:</span> {order.deliveryInstructions}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col justify-center gap-2 p-4 bg-slate-50 border-l border-slate-200 min-w-[140px]">
                                        {order.fulfillmentStatus === "unassigned" ? (
                                            <Button
                                                onClick={() => openAssignDialog(order)}
                                                disabled={locations.length === 0}
                                                className="w-full"
                                            >
                                                Assign
                                            </Button>
                                        ) : (
                                            <>
                                                {NEXT_STATUS[order.fulfillmentStatus] && (
                                                    <Button
                                                        onClick={() =>
                                                            handleUpdateStatus(
                                                                order.id,
                                                                NEXT_STATUS[order.fulfillmentStatus]!
                                                            )
                                                        }
                                                        disabled={updating === order.id}
                                                        className="w-full"
                                                    >
                                                        {updating === order.id
                                                            ? "..."
                                                            : STATUS_LABELS[NEXT_STATUS[order.fulfillmentStatus]!]}
                                                    </Button>
                                                )}
                                                {order.fulfillmentStatus !== "completed" && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openAssignDialog(order)}
                                                        className="w-full text-xs"
                                                    >
                                                        Reassign
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Assign Location Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign to Location</DialogTitle>
                        <DialogDescription>
                            Select a location to fulfill this order.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                        {locations.map((loc) => (
                            <button
                                key={loc.id}
                                onClick={() => handleAssign(loc.id)}
                                disabled={assigning}
                                className="p-4 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
                            >
                                <div className="font-medium text-slate-900">{loc.name}</div>
                                {loc.code && <div className="text-sm text-slate-500">{loc.code}</div>}
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardShell>
    );
}
