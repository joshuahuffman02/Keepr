import { SdkConfig, ReservationPayload, GuestPayload, SitePayload } from "./types";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export class DeveloperApiClient {
  private baseUrl: string;
  private accessToken?: string;
  private refreshToken?: string;
  private expiresAt?: number;

  constructor(private readonly config: SdkConfig) {
    this.baseUrl = (config.baseUrl || "http://localhost:4000/api").replace(/\/$/, "");
  }

  private async authenticate() {
    const res = await fetch(`${this.baseUrl}/developer/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: this.config.scopes?.join(" "),
      }),
    });
    if (!res.ok) {
      throw new Error(`Auth failed (${res.status})`);
    }
    const json: TokenResponse = await res.json();
    this.accessToken = json.access_token;
    this.refreshToken = json.refresh_token;
    this.expiresAt = Date.now() + json.expires_in * 1000 - 5000;
  }

  private async ensureAccessToken() {
    if (!this.accessToken || !this.expiresAt || Date.now() >= this.expiresAt) {
      await this.authenticate();
    }
  }

  private async request<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
    await this.ensureAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Try a refresh once on 401
    if (res.status === 401 && this.refreshToken) {
      await this.authenticate();
      const retry = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) throw new Error(`Request failed (${retry.status})`);
      const retryJson: T = await retry.json();
      return retryJson;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed (${res.status}): ${text}`);
    }
    const json: T = await res.json();
    return json;
  }

  // Reservations
  listReservations() {
    return this.request(`/developer/reservations`, "GET");
  }

  getReservation(id: string) {
    return this.request(`/developer/reservations/${id}`, "GET");
  }

  createReservation(payload: ReservationPayload) {
    return this.request(`/developer/reservations`, "POST", payload);
  }

  updateReservation(id: string, payload: Partial<ReservationPayload>) {
    return this.request(`/developer/reservations/${id}`, "PATCH", payload);
  }

  deleteReservation(id: string) {
    return this.request(`/developer/reservations/${id}`, "DELETE");
  }

  recordPayment(id: string, amountCents: number, method = "card") {
    return this.request(`/developer/reservations/${id}/payments`, "POST", { amountCents, method });
  }

  // Guests
  listGuests() {
    return this.request(`/developer/guests`, "GET");
  }

  getGuest(id: string) {
    return this.request(`/developer/guests/${id}`, "GET");
  }

  createGuest(payload: GuestPayload) {
    return this.request(`/developer/guests`, "POST", payload);
  }

  updateGuest(id: string, payload: Partial<GuestPayload>) {
    return this.request(`/developer/guests/${id}`, "PATCH", payload);
  }

  deleteGuest(id: string) {
    return this.request(`/developer/guests/${id}`, "DELETE");
  }

  // Sites
  listSites() {
    return this.request(`/developer/sites`, "GET");
  }

  getSite(id: string) {
    return this.request(`/developer/sites/${id}`, "GET");
  }

  createSite(payload: SitePayload) {
    return this.request(`/developer/sites`, "POST", payload);
  }

  updateSite(id: string, payload: Partial<SitePayload>) {
    return this.request(`/developer/sites/${id}`, "PATCH", payload);
  }

  deleteSite(id: string) {
    return this.request(`/developer/sites/${id}`, "DELETE");
  }

  static createMock() {
    const reservations: ReservationPayload[] = [];
    const guests: GuestPayload[] = [];
    const sites: SitePayload[] = [];

    return {
      listReservations: async () => reservations,
      createReservation: async (payload: ReservationPayload) => {
        const created = { ...payload, id: `mock-res-${reservations.length + 1}` };
        reservations.push(created);
        return created;
      },
      listGuests: async () => guests,
      createGuest: async (payload: GuestPayload) => {
        const created = { ...payload, id: `mock-guest-${guests.length + 1}` };
        guests.push(created);
        return created;
      },
      listSites: async () => sites,
      createSite: async (payload: SitePayload) => {
        const created = { ...payload, id: `mock-site-${sites.length + 1}` };
        sites.push(created);
        return created;
      },
    };
  }
}
