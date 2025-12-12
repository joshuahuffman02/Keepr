import { ReservationImportRecord } from "../dto/reservation-import.dto";

export type RmsReservation = {
  bookingId: string;
  roomId: string;
  contactId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  status?: string;
  balanceDueCents?: number;
};

export function mapRmsToInternal(payload: RmsReservation): Partial<ReservationImportRecord> {
  return {
    externalId: payload.bookingId,
    siteId: payload.roomId,
    guestId: payload.contactId,
    arrivalDate: payload.checkIn,
    departureDate: payload.checkOut,
    adults: payload.adults,
    children: payload.children ?? 0,
    status: payload.status as any,
    totalAmount: (payload.balanceDueCents ?? 0),
    paidAmount: 0,
    source: "rms",
  };
}

export function mapInternalToRms(reservation: ReservationImportRecord) {
  return {
    bookingId: reservation.externalId ?? reservation.guestId,
    roomId: reservation.siteId,
    contactId: reservation.guestId,
    checkIn: reservation.arrivalDate,
    checkOut: reservation.departureDate,
    adults: reservation.adults,
    children: reservation.children ?? 0,
    status: reservation.status,
    balanceDueCents: Math.max(0, (reservation.totalAmount ?? 0) - (reservation.paidAmount ?? 0)),
  };
}

export const rmsTransformNotes = "Normalize RMS add-ons and folio balances before import/export.";
