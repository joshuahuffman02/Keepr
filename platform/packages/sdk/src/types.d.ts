export type Scope =
  | "reservations:read"
  | "reservations:write"
  | "guests:read"
  | "guests:write"
  | "sites:read"
  | "sites:write"
  | "webhooks:read"
  | "webhooks:write";
export interface SdkConfig {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  campgroundId: string;
  scopes?: Scope[];
}
export interface ReservationPayload {
  id?: string;
  siteId: string;
  siteLocked?: boolean;
  guestId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children?: number;
  status?: string;
  notes?: string;
}
export interface GuestPayload {
  id?: string;
  primaryFirstName: string;
  primaryLastName: string;
  email: string;
  phone?: string;
}
export interface SitePayload {
  id?: string;
  name: string;
  siteNumber: string;
  siteType: string;
  maxOccupancy: number;
  rigMaxLength?: number | null;
}
