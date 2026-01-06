"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../../components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../../components/ui/table";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    ArrowLeftRight,
    Package,
    RefreshCw,
    Wrench,
    ShoppingCart,
    RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "../../../../lib/utils";

type InventoryMovement = {
    id: string;
    campgroundId: string;
    productId: string;
    locationId: string | null;
    movementType: string;
    qty: number;
    previousQty: number;
    newQty: number;
    referenceType: string | null;
    referenceId: string | null;
    notes: string | null;
    actorUserId: string;
    createdAt?: string;
    product?: { id: string; name: string; sku: string | null };
    location?: { id: string; name: string; code: string | null } | null;
    actor?: { id: string; firstName: string; lastName: string };
};

const MOVEMENT_TYPES = [
    { value: "all", label: "All Types" },
    { value: "sale", label: "Sale" },
    { value: "return", label: "Return" },
    { value: "restock", label: "Restock" },
    { value: "adjustment", label: "Adjustment" },
    { value: "transfer_out", label: "Transfer Out" },
    { value: "transfer_in", label: "Transfer In" },
];

const getMovementIcon = (type: string) => {
    switch (type) {
        case "sale":
            return <ShoppingCart className="w-4 h-4" />;
        case "return":
            return <RotateCcw className="w-4 h-4" />;
        case "restock":
            return <ArrowUpCircle className="w-4 h-4" />;
        case "adjustment":
            return <Wrench className="w-4 h-4" />;
        case "transfer_out":
            return <ArrowLeftRight className="w-4 h-4" />;
        case "transfer_in":
            return <ArrowLeftRight className="w-4 h-4" />;
        default:
            return <Package className="w-4 h-4" />;
    }
};

const getMovementColor = (type: string) => {
    switch (type) {
        case "sale":
            return "text-status-error bg-status-error/10";
        case "return":
            return "text-status-success bg-status-success/10";
        case "restock":
            return "text-status-success bg-status-success/10";
        case "adjustment":
            return "text-status-warning bg-status-warning/10";
        case "transfer_out":
            return "text-status-info bg-status-info/10";
        case "transfer_in":
            return "text-status-info bg-status-info/10";
        default:
            return "text-muted-foreground bg-muted";
    }
};

export default function InventoryMovementsPage() {
    const [selectedCg, setSelectedCg] = useState<string>("");
    const [movementType, setMovementType] = useState<string>("all");
    const [locationFilter, setLocationFilter] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    const { data: campgrounds = [] } = useQuery({
        queryKey: ["campgrounds"],
        queryFn: () => apiClient.getCampgrounds(),
    });

    const { data: locations = [] } = useQuery({
        queryKey: ["store-locations", selectedCg],
        queryFn: () => apiClient.getStoreLocations(selectedCg, true),
        enabled: !!selectedCg,
    });

    const { data: movements = [], isLoading, refetch } = useQuery({
        queryKey: ["inventory-movements", selectedCg, movementType, locationFilter, startDate, endDate],
        queryFn: () =>
            apiClient.getInventoryMovements(selectedCg, {
                movementType: movementType !== "all" ? movementType : undefined,
                locationId: locationFilter !== "all" ? locationFilter : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                limit: 200,
            }),
        enabled: !!selectedCg,
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

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "—";
        return format(new Date(dateStr), "MMM d, yyyy h:mm a");
    };

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Inventory Movements
                        </h1>
                        <p className="text-muted-foreground">
                            Audit log of all inventory changes across locations
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            <div className="w-48">
                                <Select value={movementType} onValueChange={setMovementType}>
                                    <SelectTrigger aria-label="Movement type">
                                        <SelectValue placeholder="Movement type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MOVEMENT_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-48">
                                <Select value={locationFilter} onValueChange={setLocationFilter}>
                                    <SelectTrigger aria-label="Location filter">
                                        <SelectValue placeholder="Location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Locations</SelectItem>
                                        {locations.map((loc) => (
                                            <SelectItem key={loc.id} value={loc.id}>
                                                {loc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    aria-label="Start date"
                                    className="w-40"
                                />
                                <span className="text-muted-foreground">to</span>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    aria-label="End date"
                                    className="w-40"
                                />
                            </div>
                            {(movementType !== "all" || locationFilter !== "all" || startDate || endDate) && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setMovementType("all");
                                        setLocationFilter("all");
                                        setStartDate("");
                                        setEndDate("");
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading movements...</div>
                        ) : movements.length === 0 ? (
                            <div className="text-center py-8">
                                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No inventory movements found</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead className="text-right">Change</TableHead>
                                        <TableHead className="text-right">New Qty</TableHead>
                                        <TableHead>By</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movements.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                {formatDate(m.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                        "gap-1 capitalize",
                                                        getMovementColor(m.movementType)
                                                    )}
                                                >
                                                    {getMovementIcon(m.movementType)}
                                                    {m.movementType.replace("_", " ")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{m.product?.name}</div>
                                                {m.product?.sku && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {m.product.sku}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {m.location ? (
                                                    <Badge variant="outline">
                                                        {m.location.code || m.location.name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">Shared</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                <span
                                                    className={cn(
                                                        "font-medium",
                                                        m.qty > 0 ? "text-status-success" : "text-status-error"
                                                    )}
                                                >
                                                    {m.qty > 0 ? "+" : ""}
                                                    {m.qty}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                <span className="text-muted-foreground">{m.previousQty}</span>
                                                <span className="text-muted-foreground mx-1">→</span>
                                                <span className="font-medium">{m.newQty}</span>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {m.actor
                                                    ? `${m.actor.firstName} ${m.actor.lastName}`
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                {m.notes || "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardShell>
    );
}
