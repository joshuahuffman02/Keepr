"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../../components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
    ArrowLeftRight,
    Plus,
    MoreVertical,
    CheckCircle,
    XCircle,
    Clock,
    Truck,
    Package,
    Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "../../../lib/utils";

type InventoryTransfer = Awaited<ReturnType<typeof apiClient.getInventoryTransfers>>[0];

const STATUS_CONFIG = {
    pending: { label: "Pending", icon: Clock, color: "bg-status-warning-bg text-status-warning-text" },
    in_transit: { label: "In Transit", icon: Truck, color: "bg-status-info-bg text-status-info-text" },
    completed: { label: "Completed", icon: CheckCircle, color: "bg-status-success-bg text-status-success-text" },
    cancelled: { label: "Cancelled", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

export default function TransfersPage() {
    const queryClient = useQueryClient();
    const [selectedCg, setSelectedCg] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [viewingTransfer, setViewingTransfer] = useState<InventoryTransfer | null>(null);

    // Create form state
    const [fromLocationId, setFromLocationId] = useState("");
    const [toLocationId, setToLocationId] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<Array<{ productId: string; qty: number }>>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedQty, setSelectedQty] = useState(1);

    const { data: campgrounds = [] } = useQuery({
        queryKey: ["campgrounds"],
        queryFn: () => apiClient.getCampgrounds(),
    });

    const { data: locations = [] } = useQuery({
        queryKey: ["store-locations", selectedCg],
        queryFn: () => apiClient.getStoreLocations(selectedCg),
        enabled: !!selectedCg,
    });

    const { data: products = [] } = useQuery({
        queryKey: ["store-products", selectedCg],
        queryFn: () => apiClient.getStoreProducts(selectedCg),
        enabled: !!selectedCg,
    });

    const { data: transfers = [], isLoading } = useQuery({
        queryKey: ["inventory-transfers", selectedCg, statusFilter],
        queryFn: () =>
            apiClient.getInventoryTransfers(selectedCg, {
                status: statusFilter !== "all" ? statusFilter : undefined,
            }),
        enabled: !!selectedCg,
    });

    const createMutation = useMutation({
        mutationFn: () =>
            apiClient.createInventoryTransfer(selectedCg, {
                fromLocationId,
                toLocationId,
                items,
                notes: notes || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
            closeCreateDialog();
        },
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => apiClient.approveInventoryTransfer(id, selectedCg),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
        },
    });

    const completeMutation = useMutation({
        mutationFn: (id: string) => apiClient.completeInventoryTransfer(id, selectedCg),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
            queryClient.invalidateQueries({ queryKey: ["location-inventory"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
            setViewingTransfer(null);
        },
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => apiClient.cancelInventoryTransfer(id, selectedCg),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
        },
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem("campreserv:selectedCampground");
        if (stored) {
            setSelectedCg(stored);
        } else if (campgrounds.length > 0) {
            setSelectedCg(campgrounds[0].id);
        }
    }, [campgrounds]);

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setFromLocationId("");
        setToLocationId("");
        setNotes("");
        setItems([]);
        setSelectedProductId("");
        setSelectedQty(1);
    };

    const addItem = () => {
        if (!selectedProductId || selectedQty <= 0) return;
        if (items.some((i) => i.productId === selectedProductId)) {
            setItems(items.map((i) =>
                i.productId === selectedProductId ? { ...i, qty: i.qty + selectedQty } : i
            ));
        } else {
            setItems([...items, { productId: selectedProductId, qty: selectedQty }]);
        }
        setSelectedProductId("");
        setSelectedQty(1);
    };

    const removeItem = (productId: string) => {
        setItems(items.filter((i) => i.productId !== productId));
    };

    const getProductName = (productId: string) => {
        const product = products.find((p) => p.id === productId);
        return product?.name ?? "Unknown Product";
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "—";
        return format(new Date(dateStr), "MMM d, yyyy h:mm a");
    };

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Inventory Transfers
                        </h1>
                        <p className="text-slate-500">
                            Move inventory between store locations
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateDialogOpen(true)} disabled={locations.length < 2}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Transfer
                    </Button>
                </div>

                {locations.length < 2 && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="py-4">
                            <p className="text-amber-800 text-sm">
                                You need at least 2 store locations to create transfers.
                                <a href="/store/locations" className="underline ml-1">
                                    Add locations
                                </a>
                            </p>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">All Transfers</CardTitle>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in_transit">In Transit</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8 text-slate-500">Loading transfers...</div>
                        ) : transfers.length === 0 ? (
                            <div className="text-center py-8">
                                <ArrowLeftRight className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500">No transfers found</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>From → To</TableHead>
                                        <TableHead>Items</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Requested By</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transfers.map((t) => {
                                        const config = STATUS_CONFIG[t.status];
                                        const StatusIcon = config.icon;
                                        return (
                                            <TableRow key={t.id} className="cursor-pointer" onClick={() => setViewingTransfer(t)}>
                                                <TableCell className="text-sm text-slate-500">
                                                    {formatDate(t.createdAt)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline">
                                                            {t.fromLocation?.code || t.fromLocation?.name}
                                                        </Badge>
                                                        <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                                                        <Badge variant="outline">
                                                            {t.toLocation?.code || t.toLocation?.name}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="flex items-center gap-1">
                                                        <Package className="w-4 h-4 text-slate-400" />
                                                        {t._count?.items ?? t.items?.length ?? 0} items
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn("gap-1", config.color)}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {t.requestedBy
                                                        ? `${t.requestedBy.firstName} ${t.requestedBy.lastName}`
                                                        : "—"}
                                                </TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    {(t.status === "pending" || t.status === "in_transit") && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                {t.status === "pending" && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => approveMutation.mutate(t.id)}
                                                                    >
                                                                        <Truck className="w-4 h-4 mr-2" />
                                                                        Approve & Ship
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem
                                                                    onClick={() => completeMutation.mutate(t.id)}
                                                                >
                                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                                    Complete Transfer
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-red-600"
                                                                    onClick={() => cancelMutation.mutate(t.id)}
                                                                >
                                                                    <XCircle className="w-4 h-4 mr-2" />
                                                                    Cancel
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create Transfer Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={() => closeCreateDialog()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Inventory Transfer</DialogTitle>
                        <DialogDescription>
                            Move products from one location to another
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>From Location</Label>
                                <Select value={fromLocationId} onValueChange={setFromLocationId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations
                                            .filter((l) => l.id !== toLocationId)
                                            .map((loc) => (
                                                <SelectItem key={loc.id} value={loc.id}>
                                                    {loc.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>To Location</Label>
                                <Select value={toLocationId} onValueChange={setToLocationId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select destination" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations
                                            .filter((l) => l.id !== fromLocationId)
                                            .map((loc) => (
                                                <SelectItem key={loc.id} value={loc.id}>
                                                    {loc.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Add Products</Label>
                            <div className="flex gap-2">
                                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products
                                            .filter((p) => p.trackInventory)
                                            .map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    type="number"
                                    min={1}
                                    value={selectedQty}
                                    onChange={(e) => setSelectedQty(parseInt(e.target.value) || 1)}
                                    className="w-20"
                                />
                                <Button onClick={addItem} disabled={!selectedProductId}>
                                    Add
                                </Button>
                            </div>
                        </div>

                        {items.length > 0 && (
                            <div className="space-y-2">
                                <Label>Transfer Items</Label>
                                <div className="border rounded-lg divide-y">
                                    {items.map((item) => (
                                        <div
                                            key={item.productId}
                                            className="flex items-center justify-between p-3"
                                        >
                                            <span className="font-medium">{getProductName(item.productId)}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-600">Qty: {item.qty}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeItem(item.productId)}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Notes (optional)</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Reason for transfer..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeCreateDialog}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={
                                !fromLocationId ||
                                !toLocationId ||
                                items.length === 0 ||
                                createMutation.isPending
                            }
                        >
                            {createMutation.isPending ? "Creating..." : "Create Transfer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Transfer Dialog */}
            <Dialog open={!!viewingTransfer} onOpenChange={() => setViewingTransfer(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transfer Details</DialogTitle>
                    </DialogHeader>
                    {viewingTransfer && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                        {viewingTransfer.fromLocation?.name}
                                    </Badge>
                                    <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                                    <Badge variant="outline">
                                        {viewingTransfer.toLocation?.name}
                                    </Badge>
                                </div>
                                <Badge className={cn("gap-1", STATUS_CONFIG[viewingTransfer.status].color)}>
                                    {STATUS_CONFIG[viewingTransfer.status].label}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500">Requested By:</span>
                                    <p className="font-medium">
                                        {viewingTransfer.requestedBy
                                            ? `${viewingTransfer.requestedBy.firstName} ${viewingTransfer.requestedBy.lastName}`
                                            : "—"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Created:</span>
                                    <p className="font-medium">{formatDate(viewingTransfer.createdAt)}</p>
                                </div>
                            </div>

                            {viewingTransfer.notes && (
                                <div className="text-sm">
                                    <span className="text-slate-500">Notes:</span>
                                    <p className="mt-1">{viewingTransfer.notes}</p>
                                </div>
                            )}

                            <div>
                                <Label className="mb-2">Items</Label>
                                <div className="border rounded-lg divide-y">
                                    {viewingTransfer.items?.map((item) => (
                                        <div key={item.productId} className="flex items-center justify-between p-3">
                                            <span>{item.product?.name ?? getProductName(item.productId)}</span>
                                            <Badge variant="secondary">Qty: {item.qty}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        {viewingTransfer && (viewingTransfer.status === "pending" || viewingTransfer.status === "in_transit") && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        cancelMutation.mutate(viewingTransfer.id);
                                        setViewingTransfer(null);
                                    }}
                                >
                                    Cancel Transfer
                                </Button>
                                <Button
                                    onClick={() => completeMutation.mutate(viewingTransfer.id)}
                                    disabled={completeMutation.isPending}
                                >
                                    {completeMutation.isPending ? "Completing..." : "Complete Transfer"}
                                </Button>
                            </>
                        )}
                        {viewingTransfer && (viewingTransfer.status === "completed" || viewingTransfer.status === "cancelled") && (
                            <Button variant="outline" onClick={() => setViewingTransfer(null)}>
                                Close
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardShell>
    );
}
