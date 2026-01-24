"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeveloperApiClient = void 0;
class DeveloperApiClient {
  constructor(config) {
    this.config = config;
    this.baseUrl = (config.baseUrl || "http://localhost:4000/api").replace(/\/$/, "");
  }
  async authenticate() {
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
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
    const json = await res.json();
    this.accessToken = json.access_token;
    this.refreshToken = json.refresh_token;
    this.expiresAt = Date.now() + json.expires_in * 1000 - 5000;
  }
  async ensureAccessToken() {
    if (!this.accessToken || !this.expiresAt || Date.now() >= this.expiresAt) {
      await this.authenticate();
    }
  }
  async request(path, method = "GET", body) {
    await this.ensureAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
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
      return retry.json();
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed (${res.status}): ${text}`);
    }
    return res.json();
  }
  listReservations() {
    return this.request(`/public/reservations`, "GET");
  }
  getReservation(id) {
    return this.request(`/public/reservations/${id}`, "GET");
  }
  createReservation(payload) {
    return this.request(`/public/reservations`, "POST", payload);
  }
  updateReservation(id, payload) {
    return this.request(`/public/reservations/${id}`, "PATCH", payload);
  }
  deleteReservation(id) {
    return this.request(`/public/reservations/${id}`, "DELETE");
  }
  recordPayment(id, amountCents, method = "card") {
    return this.request(`/public/reservations/${id}/payments`, "POST", { amountCents, method });
  }
  listGuests() {
    return this.request(`/public/guests`, "GET");
  }
  getGuest(id) {
    return this.request(`/public/guests/${id}`, "GET");
  }
  createGuest(payload) {
    return this.request(`/public/guests`, "POST", payload);
  }
  updateGuest(id, payload) {
    return this.request(`/public/guests/${id}`, "PATCH", payload);
  }
  deleteGuest(id) {
    return this.request(`/public/guests/${id}`, "DELETE");
  }
  listSites() {
    return this.request(`/public/sites`, "GET");
  }
  getSite(id) {
    return this.request(`/public/sites/${id}`, "GET");
  }
  createSite(payload) {
    return this.request(`/public/sites`, "POST", payload);
  }
  updateSite(id, payload) {
    return this.request(`/public/sites/${id}`, "PATCH", payload);
  }
  deleteSite(id) {
    return this.request(`/public/sites/${id}`, "DELETE");
  }
  static createMock() {
    const reservations = [];
    const guests = [];
    const sites = [];
    return {
      listReservations: async () => reservations,
      createReservation: async (payload) => {
        const created = { ...payload, id: `mock-res-${reservations.length + 1}` };
        reservations.push(created);
        return created;
      },
      listGuests: async () => guests,
      createGuest: async (payload) => {
        const created = { ...payload, id: `mock-guest-${guests.length + 1}` };
        guests.push(created);
        return created;
      },
      listSites: async () => sites,
      createSite: async (payload) => {
        const created = { ...payload, id: `mock-site-${sites.length + 1}` };
        sites.push(created);
        return created;
      },
    };
  }
}
exports.DeveloperApiClient = DeveloperApiClient;
//# sourceMappingURL=client.js.map
