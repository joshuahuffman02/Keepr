import React from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Search, Filter, RefreshCw, X } from "lucide-react";

interface CalendarFiltersProps {
    filters: {
        statusFilter: string;
        siteTypeFilter: string;
        channelFilter: string;
        assignmentFilter: string;
        guestSearch: string;
    };
    actions: {
        setStatusFilter: (v: string) => void;
        setSiteTypeFilter: (v: string) => void;
        setChannelFilter: (v: string) => void;
        setAssignmentFilter: (v: any) => void;
        setGuestSearch: (v: string) => void;
    };
}

export function CalendarFilters({ filters, actions }: CalendarFiltersProps) {
    return (
        <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="space-y-1.5 min-w-[140px]">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Guest Search</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                        placeholder="Name, email, phone..."
                        className="h-9 pl-9 text-sm"
                        value={filters.guestSearch}
                        onChange={(e) => actions.setGuestSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-1.5 min-w-[120px]">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Status</Label>
                <Select value={filters.statusFilter} onValueChange={actions.setStatusFilter}>
                    <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="checked_in">Checked In</SelectItem>
                        <SelectItem value="pending">Hold / Pending</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5 min-w-[120px]">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Site Type</Label>
                <Select value={filters.siteTypeFilter} onValueChange={actions.setSiteTypeFilter}>
                    <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="rv">RV Sites</SelectItem>
                        <SelectItem value="tent">Tent Sites</SelectItem>
                        <SelectItem value="cabin">Cabins</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2 mt-auto">
                {(filters.guestSearch || filters.statusFilter !== "all" || filters.siteTypeFilter !== "all") && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            actions.setGuestSearch("");
                            actions.setStatusFilter("all");
                            actions.setSiteTypeFilter("all");
                        }}
                        className="h-9 text-xs text-slate-500 hover:text-slate-900"
                    >
                        Clear Filters
                    </Button>
                )}
            </div>
        </div>
    );
}
