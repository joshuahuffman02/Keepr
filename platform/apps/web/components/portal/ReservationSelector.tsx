"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInCalendarDays } from "date-fns";
import { ChevronDown, MapPin, Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, getReservationStatusVariant, getStatusLabel } from "./StatusBadge";

type Reservation = {
  id: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  campground: {
    name: string;
    slug: string;
  };
  site: {
    name: string;
    siteNumber: string;
  };
};

interface ReservationSelectorProps {
  reservations: Reservation[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ReservationSelector({
  reservations,
  selectedId,
  onSelect,
}: ReservationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = reservations.find((r) => r.id === selectedId);

  if (reservations.length <= 1) {
    return null; // Don't show selector if only one reservation
  }

  const now = new Date();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all",
          "bg-card hover:bg-muted/50 border-border",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isOpen && "ring-2 ring-primary ring-offset-2",
        )}
      >
        <div className="flex items-center gap-3 text-left">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
            {reservations.indexOf(reservations.find((r) => r.id === selectedId)!) + 1}
          </div>
          <div>
            <p className="font-medium text-foreground">{selected?.campground.name}</p>
            <p className="text-sm text-muted-foreground">
              {selected && format(new Date(selected.arrivalDate), "MMM d")} -{" "}
              {selected && format(new Date(selected.departureDate), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {reservations.length} reservations
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              role="listbox"
              className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
            >
              <div className="p-2 space-y-1 max-h-80 overflow-auto">
                {reservations.map((reservation, index) => {
                  const isSelected = reservation.id === selectedId;
                  const arrival = new Date(reservation.arrivalDate);
                  const daysUntil = differenceInCalendarDays(arrival, now);
                  const isPast = new Date(reservation.departureDate) < now;

                  return (
                    <button
                      key={reservation.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelect(reservation.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all",
                        isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50",
                        isPast && "opacity-60",
                      )}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isSelected ? <Check className="h-4 w-4" /> : index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">
                            {reservation.campground.name}
                          </p>
                          <StatusBadge
                            status={getStatusLabel(reservation.status)}
                            variant={getReservationStatusVariant(reservation.status)}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(arrival, "MMM d")} -{" "}
                            {format(new Date(reservation.departureDate), "MMM d")}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Site {reservation.site.siteNumber}
                          </span>
                        </div>
                        {!isPast && daysUntil >= 0 && (
                          <p className="text-xs text-primary mt-1">
                            {daysUntil === 0
                              ? "Arriving today!"
                              : daysUntil === 1
                                ? "Arriving tomorrow"
                                : `${daysUntil} days away`}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
