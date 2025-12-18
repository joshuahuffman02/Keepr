/**
 * Calendar-specific types
 * These complement the shared types from @campreserv/shared
 */

import type { Reservation, Site, Guest, Campground } from "@campreserv/shared";

// Day metadata for calendar grid
export interface DayMeta {
  date: Date;
  label: string;
  weekend: boolean;
  isToday: boolean;
}

// Calendar reservation with guest and site info
// Using Omit to override the site/guest types from base Reservation
export interface CalendarReservation extends Omit<Reservation, 'site' | 'guest'> {
  guest?: {
    primaryFirstName?: string | null;
    primaryLastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  site?: {
    id: string;
    name?: string | null;
    siteNumber?: string | null;
    siteType?: string | null;
  };
}

// Calendar site with display properties
export interface CalendarSite extends Site {
  siteClass?: {
    name: string;
    defaultRate: number;
    maxOccupancy?: number;
  } | null;
}

// Selection state for drag operations
export interface CalendarSelection {
  siteId: string;
  arrival: string;
  departure: string;
}

// Drag state for selection
export interface DragState {
  siteId: string | null;
  startIdx: number | null;
  endIdx: number | null;
  isDragging: boolean;
}

// Gantt selection state from store
export interface GanttSelection {
  highlightedId: string | null;
  openDetailsId: string | null;
}

// Blackout date
export interface CalendarBlackout {
  id: string;
  siteId?: string | null;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

// Conflict between reservations
export interface ReservationConflict {
  siteId: string;
  overlapStart?: Date;
  overlapEnd?: Date;
  a?: CalendarReservation | null;
  b?: CalendarReservation | null;
}

// Quote preview for selection
export interface QuotePreview {
  siteId: string;
  siteName: string;
  arrival: string;
  departure: string;
  total: number;
  nights: number;
  base: number;
  perNight: number;
  rulesDelta: number;
  depositRule: string | null;
}

// Extend prompt for modifications
export interface ExtendPrompt {
  reservation: CalendarReservation;
  arrivalDate: string;
  departureDate: string;
  totalCents: number;
  deltaCents: number;
}

// Hold status
export interface HoldStatus {
  state: "idle" | "loading" | "success" | "error";
  message?: string;
}

// Communication record
export interface CalendarCommunication {
  id: string;
  type: "email" | "sms" | "note" | "call";
  direction: "inbound" | "outbound";
  subject?: string | null;
  body?: string | null;
  preview?: string | null;
  status: string;
  createdAt?: string;
}

// Reservation status type
export type ReservationStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";

// Site type
export type SiteType = "rv" | "tent" | "cabin" | "group" | "glamping";

// View mode for calendar
export type CalendarViewMode = "day" | "week" | "month" | "list";

// Assignment filter
export type AssignmentFilter = "all" | "assigned" | "unassigned";
