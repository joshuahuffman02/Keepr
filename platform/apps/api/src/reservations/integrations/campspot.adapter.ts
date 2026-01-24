import { ReservationImportRecord } from "../dto/reservation-import.dto";

export type CampspotReservation = {
  reservationNumber: string;
  siteExternalId: string;
  guestExternalId: string;
  arrival: string;
  departure: string;
  adults: number;
  children?: number;
  status?: string;
  totalCents?: number;
  paidCents?: number;
};

type ImportStatus = ReservationImportRecord["status"];

const RESERVATION_STATUS_MAP: Record<ImportStatus, true> = {
  pending: true,
  confirmed: true,
  checked_in: true,
  checked_out: true,
  cancelled: true,
};

const isImportStatus = (value: string): value is ImportStatus => value in RESERVATION_STATUS_MAP;

const normalizeReservationStatus = (value?: string): ImportStatus | undefined =>
  value && isImportStatus(value) ? value : undefined;

export function mapCampspotToInternal(
  payload: CampspotReservation,
): Partial<ReservationImportRecord> {
  return {
    externalId: payload.reservationNumber,
    siteId: payload.siteExternalId,
    guestId: payload.guestExternalId,
    arrivalDate: payload.arrival,
    departureDate: payload.departure,
    adults: payload.adults,
    children: payload.children ?? 0,
    status: normalizeReservationStatus(payload.status),
    totalAmount: payload.totalCents ?? 0,
    paidAmount: payload.paidCents ?? 0,
    source: "campspot",
  };
}

export function mapInternalToCampspot(reservation: ReservationImportRecord) {
  return {
    reservationNumber: reservation.externalId ?? reservation.guestId,
    siteExternalId: reservation.siteId,
    guestExternalId: reservation.guestId,
    arrival: reservation.arrivalDate,
    departure: reservation.departureDate,
    adults: reservation.adults,
    children: reservation.children ?? 0,
    status: reservation.status,
    totalCents: reservation.totalAmount,
    paidCents: reservation.paidAmount ?? 0,
  };
}

// Additional transform stubs for later enrichment
export const campspotNotes =
  "Map add-ons, taxes, and discounts to line items during import/export.";
