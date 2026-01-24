import { SdkConfig, ReservationPayload, GuestPayload, SitePayload } from "./types";
export declare class DeveloperApiClient {
  private readonly config;
  private baseUrl;
  private accessToken?;
  private refreshToken?;
  private expiresAt?;
  constructor(config: SdkConfig);
  private authenticate;
  private ensureAccessToken;
  private request;
  listReservations(): Promise<unknown>;
  getReservation(id: string): Promise<unknown>;
  createReservation(payload: ReservationPayload): Promise<unknown>;
  updateReservation(id: string, payload: Partial<ReservationPayload>): Promise<unknown>;
  deleteReservation(id: string): Promise<unknown>;
  recordPayment(id: string, amountCents: number, method?: string): Promise<unknown>;
  listGuests(): Promise<unknown>;
  getGuest(id: string): Promise<unknown>;
  createGuest(payload: GuestPayload): Promise<unknown>;
  updateGuest(id: string, payload: Partial<GuestPayload>): Promise<unknown>;
  deleteGuest(id: string): Promise<unknown>;
  listSites(): Promise<unknown>;
  getSite(id: string): Promise<unknown>;
  createSite(payload: SitePayload): Promise<unknown>;
  updateSite(id: string, payload: Partial<SitePayload>): Promise<unknown>;
  deleteSite(id: string): Promise<unknown>;
  static createMock(): {
    listReservations: () => Promise<ReservationPayload[]>;
    createReservation: (payload: ReservationPayload) => Promise<{
      id: string;
      siteId: string;
      siteLocked?: boolean;
      guestId: string;
      arrivalDate: string;
      departureDate: string;
      adults: number;
      children?: number;
      status?: string;
      notes?: string;
    }>;
    listGuests: () => Promise<GuestPayload[]>;
    createGuest: (payload: GuestPayload) => Promise<{
      id: string;
      primaryFirstName: string;
      primaryLastName: string;
      email: string;
      phone?: string;
    }>;
    listSites: () => Promise<SitePayload[]>;
    createSite: (payload: SitePayload) => Promise<{
      id: string;
      name: string;
      siteNumber: string;
      siteType: string;
      maxOccupancy: number;
      rigMaxLength?: number | null;
    }>;
  };
}
