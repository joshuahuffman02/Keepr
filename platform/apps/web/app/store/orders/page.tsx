"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle, Eye, RefreshCw, Check, Truck, List } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StoreOrder = Awaited<ReturnType<typeof apiClient.getStoreOrders>>[0];

// Extended type with additional properties from the API
type StoreOrderWithExtras = StoreOrder & {
  seenAt?: string | null;
  siteNumber?: string | null;
  createdAt?: string;
  completedBy?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
  } | null;
  completedAt?: string | null;
  reservation?: {
    site?: {
      siteNumber?: string;
    } | null;
  } | null;
  items: Array<{
    name: string;
    qty: number;
    totalCents?: number;
  }>;
  notes?: string | null;
};

export default function StoreOrdersPage() {
  const { toast } = useToast();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [orders, setOrders] = useState<StoreOrderWithExtras[]>([]);
  const [unseen, setUnseen] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "completed" | "all">("pending");
  const lastUnseenRef = useRef<number>(0);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) setCampgroundId(stored);
  }, []);

  const load = async () => {
    if (!campgroundId) return;
    setLoading(true);
    try {
      const data = await apiClient.getStoreOrders(campgroundId, { status: statusFilter === "all" ? undefined : statusFilter });
      setOrders(data);
      const unseenData = await apiClient.getStoreUnseen(campgroundId);
      setUnseen(unseenData.length);
      lastUnseenRef.current = unseenData.length;
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [campgroundId, statusFilter]);

  // Poll for new unseen orders to notify staff
  useEffect(() => {
    if (!campgroundId) return;
    const interval = setInterval(async () => {
      try {
        const unseenData = await apiClient.getStoreUnseen(campgroundId);
        const count = unseenData.length;
        if (count > lastUnseenRef.current) {
          toast({
            title: "New store order",
            description: `${count - lastUnseenRef.current} new order(s) placed.`,
          });
        }
        setUnseen(count);
        lastUnseenRef.current = count;
      } catch {
        // ignore polling errors
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [campgroundId, toast]);

  const markSeen = async (id: string) => {
    try {
      await apiClient.markStoreOrderSeen(id);
      await load();
    } catch (err) {
      toast({ title: "Error", description: "Failed to mark seen", variant: "destructive" });
    }
  };

  const complete = async (id: string) => {
    try {
      await apiClient.completeStoreOrder(id);
      toast({ title: "Order completed" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: "Failed to complete order", variant: "destructive" });
    }
  };

  const badge = useMemo(() => {
    if (unseen > 0) return <Badge variant="destructive">{unseen} new</Badge>;
    return <Badge variant="secondary">No new</Badge>;
  }, [unseen]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<StoreOrderWithExtras | null>(null);

  const showDetails = (order: StoreOrderWithExtras) => {
    setDetailOrder(order);
    setDetailOpen(true);
  };

  const setStatus = async (id: string, status: "ready" | "delivered" | "completed") => {
    try {
      await apiClient.updateStoreOrderStatus(id, status);
      toast({ title: `Order marked ${status}` });
      await load();
    } catch (err) {
      toast({ title: "Error", description: "Failed to update order", variant: "destructive" });
    }
  };

  if (!campgroundId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Store Orders</CardTitle>
          </CardHeader>
          <CardContent>Select a campground to view orders.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Store Orders</h1>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          <Button variant={statusFilter === "pending" ? "default" : "outline"} onClick={() => setStatusFilter("pending")}>Pending</Button>
          <Button variant={statusFilter === "completed" ? "default" : "outline"} onClick={() => setStatusFilter("completed")}>Completed</Button>
          <Button variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Placed</TableHead>
                    <TableHead>Completed By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === "completed" ? "outline" : "default"}>
                        {order.status}
                      </Badge>
                      {!order.seenAt && order.status === "pending" && (
                        <Badge variant="destructive" className="ml-2">New</Badge>
                      )}
                    </TableCell>
                    <TableCell>{order.siteNumber || order.reservation?.site?.siteNumber || "—"}</TableCell>
                    <TableCell>${(order.totalCents / 100).toFixed(2)}</TableCell>
                    <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}</TableCell>
                    <TableCell>
                      {order.completedBy
                        ? `${order.completedBy.firstName || ""} ${order.completedBy.lastName || ""}`.trim() || order.completedBy.email
                        : order.completedAt
                          ? "Completed"
                          : "—"}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => showDetails(order)}>
                        <List className="h-3 w-3 mr-1" /> View
                      </Button>
                      {order.status === "pending" && (
                        <>
                          {!order.seenAt && (
                            <Button size="sm" variant="outline" onClick={() => markSeen(order.id)}>
                              <Eye className="h-3 w-3 mr-1" /> Mark seen
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setStatus(order.id, "ready")}>
                            <Check className="h-3 w-3 mr-1" /> Ready
                          </Button>
                        </>
                      )}
                      {order.status === "ready" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(order.id, "delivered")}>
                          <Truck className="h-3 w-3 mr-1" /> Delivered
                        </Button>
                      )}
                      {(order.status === "delivered" || order.status === "ready" || order.status === "pending") && (
                        <Button size="sm" onClick={() => setStatus(order.id, "completed")}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {detailOrder ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Order ID: <span className="font-mono">{detailOrder.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={detailOrder.status === "completed" ? "outline" : "default"}>
                  {detailOrder.status}
                </Badge>
                {detailOrder.siteNumber && <Badge variant="secondary">Site {detailOrder.siteNumber}</Badge>}
              </div>
              <div className="text-sm">
                Total: <span className="font-semibold">${(detailOrder.totalCents / 100).toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Items</div>
                <ul className="space-y-1 text-sm">
                  {detailOrder.items.map((item) => (
                    <li key={`${item.name}-${item.qty}`} className="flex justify-between">
                      <span>{item.qty} × {item.name}</span>
                      <span>${((item.totalCents ?? 0) / 100).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {detailOrder.notes && (
                <div className="text-sm">
                  <div className="font-medium">Notes</div>
                  <div className="text-muted-foreground whitespace-pre-line">{detailOrder.notes}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No order selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

