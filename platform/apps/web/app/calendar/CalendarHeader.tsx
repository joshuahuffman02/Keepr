import React from "react";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, CalendarDays, Maximize2 } from "lucide-react";
import { formatLocalDateInput, parseLocalDateInput } from "./utils";

interface CalendarHeaderProps {
    campgrounds: any[];
    selectedCampground: string;
    setSelectedCampground: (v: string) => void;
    startDate: string;
    setStartDate: (v: string) => void;
    viewMode: string;
    setViewMode: (v: any) => void;
    onToday: () => void;
}

export function CalendarHeader({
    campgrounds,
    selectedCampground,
    setSelectedCampground,
    startDate,
    setStartDate,
    viewMode,
    setViewMode,
    onToday
}: CalendarHeaderProps) {

    const handlePrev = () => {
        const d = parseLocalDateInput(startDate);
        d.setDate(d.getDate() - 7);
        setStartDate(formatLocalDateInput(d));
    };

    const handleNext = () => {
        const d = parseLocalDateInput(startDate);
        d.setDate(d.getDate() + 7);
        setStartDate(formatLocalDateInput(d));
    };

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                    <CalendarIcon className="h-8 w-8 text-blue-600" />
                    Interactive Calendar
                </h1>
                <p className="text-sm text-slate-500 font-medium">Manage bookings, site availability, and ops in real-time.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedCampground} onValueChange={setSelectedCampground}>
                    <SelectTrigger className="w-[200px] h-10 border-slate-200 shadow-sm transition-all hover:border-blue-300">
                        <SelectValue placeholder="Select Campground" />
                    </SelectTrigger>
                    <SelectContent>
                        {campgrounds.map((cg) => (
                            <SelectItem key={cg.id} value={cg.id}>{cg.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

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
    );
}
