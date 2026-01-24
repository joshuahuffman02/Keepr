import { CreateReservationDto } from "./src/reservations/dto/create-reservation.dto";

const API_BASE = "http://localhost:4001/api";

async function run() {
  console.log("Starting Waitlist Verification (API Mode)...");

  try {
    // 1. Create Organization & Campground (We need to use existing or create new via API if possible)
    // Since we don't have easy public endpoints for creating orgs/campgrounds without auth in this script context (unless we have a token),
    // we might need to rely on existing data or use a "seed" endpoint if available.
    // However, I can try to use the public API or just assume I can create guests/reservations if I have a campground ID.

    // Let's try to fetch campgrounds first to get a valid ID.
    const campgroundsRes = await fetch(`${API_BASE}/campgrounds`);
    if (!campgroundsRes.ok) throw new Error("Failed to fetch campgrounds");
    const campgrounds = await campgroundsRes.json();

    let campgroundId = campgrounds[0]?.id;

    if (!campgroundId) {
      console.log("No campgrounds found. Cannot proceed.");
      return;
    }

    console.log(`Using campground: ${campgroundId}`);

    // 2. Get Sites
    const sitesRes = await fetch(`${API_BASE}/campgrounds/${campgroundId}/sites`);
    const sites = await sitesRes.json();
    const site = sites[0];

    if (!site) {
      console.log("No sites found. Cannot proceed.");
      return;
    }
    console.log(`Using site: ${site.id} (${site.name})`);

    // 3. Create Guest 1
    const guest1Res = await fetch(`${API_BASE}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryFirstName: "John",
        primaryLastName: "Doe",
        email: `john-${Date.now()}@example.com`,
        phone: "1234567890",
      }),
    });
    const guest1 = await guest1Res.json();
    console.log(`Created Guest 1: ${guest1.id}`);

    // 4. Create Guest 2
    const guest2Res = await fetch(`${API_BASE}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryFirstName: "Jane",
        primaryLastName: "Smith",
        email: `jane-${Date.now()}@example.com`,
        phone: "0987654321",
      }),
    });
    const guest2 = await guest2Res.json();
    console.log(`Created Guest 2: ${guest2.id}`);

    // Dates
    const arrival = new Date();
    arrival.setDate(arrival.getDate() + 20);
    const departure = new Date();
    departure.setDate(departure.getDate() + 22);

    // 5. Create Reservation for Guest 1
    console.log("Creating reservation for Guest 1...");
    const resRes = await fetch(`${API_BASE}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campgroundId,
        siteId: site.id,
        guestId: guest1.id,
        arrivalDate: arrival.toISOString(),
        departureDate: departure.toISOString(),
        adults: 2,
        children: 0,
        totalAmount: 10000,
        paidAmount: 10000,
        status: "confirmed",
      }),
    });

    if (!resRes.ok) {
      console.error("Failed to create reservation:", await resRes.text());
      return;
    }

    const reservation = await resRes.json();
    console.log("Reservation created:", reservation.id);

    // 6. Join Waitlist for Guest 2
    console.log("Joining waitlist for Guest 2...");
    const wlRes = await fetch(`${API_BASE}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campgroundId,
        guestId: guest2.id,
        siteId: site.id,
        arrivalDate: arrival.toISOString(),
        departureDate: departure.toISOString(),
      }),
    });

    if (!wlRes.ok) {
      console.error("Failed to join waitlist:", await wlRes.text());
      return;
    }

    const waitlistEntry = await wlRes.json();
    console.log("Waitlist entry created:", waitlistEntry.id);

    // 7. Cancel Reservation
    console.log("Cancelling reservation...");
    const cancelRes = await fetch(`${API_BASE}/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "cancelled",
      }),
    });

    if (!cancelRes.ok) {
      console.error("Failed to cancel reservation:", await cancelRes.text());
      return;
    }

    console.log("Reservation cancelled successfully.");
    console.log("VERIFICATION COMPLETE: Check server logs for email notification.");
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
