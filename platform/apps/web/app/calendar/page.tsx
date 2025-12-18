"use client";

import React, { useState } from "react";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { useCalendarData } from "./useCalendarData";
import { CalendarProvider } from "./CalendarContext";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarFilters } from "./CalendarFilters";
import { CalendarGrid } from "./CalendarGrid";
import { ListView } from "./ListView";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { X, Sparkles, TrendingUp, Users, Calendar as CalendarIcon, DollarSign } from "lucide-react";

export default function CalendarPage() {
  return (
    <CalendarProvider>
      <CalendarContent />
    </CalendarProvider>
  );
}

function CalendarContent() {
  const data = useCalendarData();
  const { state, actions, queries, derived } = data;
  const { campgrounds } = queries;
  const { selectedCampgroundDetails, allowOps } = derived;

  return (
    <DashboardShell>
      <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Calendar", href: "/calendar" }
          ]}
        />

        <CalendarHeader
          campgrounds={campgrounds.data || []}
          selectedCampground={state.selectedCampground}
          setSelectedCampground={actions.setSelectedCampground}
          startDate={state.startDate}
          setStartDate={actions.setStartDate}
          viewMode={state.viewMode}
          setViewMode={actions.setViewMode}
          onToday={() => actions.setStartDate(new Date().toISOString().split("T")[0])}
        />

        {state.viewMode !== "list" && (
          <CalendarFilters
            filters={state}
            actions={actions}
          />
        )}

        {state.viewMode === "list" ? (
          <ListView
            reservations={derived.filteredReservations}
            sites={queries.sites.data || []}
            onReservationClick={(res) => console.log("Open", res)}
            onNewBooking={() => { }}
            allowOps={allowOps}
          />
        ) : (
          <div className="relative">
            <CalendarGrid
              data={data}
              onSelectionComplete={(siteId, arrival, departure) => {
                actions.selectRange(siteId, arrival, departure);
              }}
            />

            {/* Premium Quote Overlay */}
            {state.selection && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500 ease-out">
                <Card className="p-4 bg-slate-900/95 backdrop-blur-xl border-slate-800 shadow-2xl flex items-center gap-6 min-w-[500px] text-white overflow-hidden group">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Draft Booking</span>
                    <span className="text-sm font-bold truncate max-w-[150px]">{state.selection.siteName}</span>
                  </div>

                  <div className="h-8 w-px bg-slate-800" />

                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dates</span>
                    <span className="text-sm font-bold whitespace-nowrap">
                      {state.selection.arrival} → {state.selection.departure}
                    </span>
                  </div>

                  <div className="ml-auto flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">Total Est.</span>
                      <span className="text-xl font-black text-white">${(state.selection.total / 100).toFixed(2)}</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                      onClick={() => actions.setSelection(null)}
                    >
                      Book Now
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-white"
                      onClick={() => actions.setSelection(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Animated highlight */}
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Mini Stats Bar (Premium touch) */}
        {!queries.sites.isLoading && state.viewMode !== "list" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <Card className="p-4 bg-white/50 border-slate-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Avg. Occupancy</div>
                <div className="text-lg font-black text-slate-900">78%</div>
              </div>
            </Card>
            <Card className="p-4 bg-white/50 border-slate-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Projected Rev.</div>
                <div className="text-lg font-black text-slate-900">$12,450</div>
              </div>
            </Card>
            <Card className="p-4 bg-white/50 border-slate-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Active Stays</div>
                <div className="text-lg font-black text-slate-900">{derived.filteredReservations.length}</div>
              </div>
            </Card>
            <Card className="p-4 bg-white/50 border-slate-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Clean Sites</div>
                <div className="text-lg font-black text-slate-900">12/15</div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
