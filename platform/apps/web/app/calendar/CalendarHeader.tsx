import React from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, CalendarDays, Maximize2, CalendarRange, Plus, Ban, Wrench, ClipboardCheck } from "lucide-react";
import { formatLocalDateInput, parseLocalDateInput } from "./utils";
import { cn } from "../../lib/utils";

interface CalendarHeaderProps {
    startDate: string;
    setStartDate: (v: string) => void;
    viewMode: string;
    setViewMode: (v: any) => void;
    onToday: () => void;
    dayCount: number;
    setDayCount: (v: number) => void;
}

export function CalendarHeader({
    startDate,
    setStartDate,
    viewMode,
    setViewMode,
    onToday,
    dayCount,
    setDayCount
}: CalendarHeaderProps) {

    const handlePrev = () => {
        const d = parseLocalDateInput(startDate);
        // Step by the visible range
        d.setDate(d.getDate() - dayCount);
        setStartDate(formatLocalDateInput(d));
    };

    const handleNext = () => {
        const d = parseLocalDateInput(startDate);
        d.setDate(d.getDate() + dayCount);
        setStartDate(formatLocalDateInput(d));
    };

    return (
        <div className="flex flex-col gap-4 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <CalendarIcon className="h-8 w-8 text-status-info" />
                        Interactive Calendar
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Manage bookings, site availability, and ops in real-time.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* View Toggles (7d, 14d, 30d) */}
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
                        {[7, 14, 30].map((d) => (
                            <Button
                                key={d}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "px-3 h-8 text-[10px] font-bold uppercase tracking-tight",
                                    dayCount === d ? "bg-muted text-status-info" : "text-muted-foreground"
                                )}
                                onClick={() => setDayCount(d)}
                            >
                                {d}d
                            </Button>
                        ))}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-status-info"
                            title="Custom Range"
                        >
                            <CalendarRange className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={handlePrev}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="px-3 h-8 text-xs font-bold uppercase tracking-tight" onClick={onToday}>
                            Today
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={handleNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <Button
                            variant={viewMode === "week" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 px-3 text-xs font-bold"
                            onClick={() => setViewMode("week")}
                        >
                            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                            Timeline
                        </Button>
                        <Button
                            variant={viewMode === "list" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 px-3 text-xs font-bold"
                            onClick={() => setViewMode("list")}
                        >
                            <List className="h-3.5 w-3.5 mr-1.5" />
                            List
                        </Button>
                    </div>
                </div>
            </div>

            {/* Quick Actions Row */}
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 text-xs font-semibold" asChild>
                    <Link href="/booking">
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        New Reservation
                    </Link>
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs font-semibold" asChild>
                    <Link href="/calendar/block">
                        <Ban className="h-3.5 w-3.5 mr-1.5" />
                        Block Dates
                    </Link>
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs font-semibold" asChild>
                    <Link href="/reservations?status=confirmed&checkInDate=today">
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                        Check-ins Today
                    </Link>
                </Button>
            </div>
        </div>
    );
}
