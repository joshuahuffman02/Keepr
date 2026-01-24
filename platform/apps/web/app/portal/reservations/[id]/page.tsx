import { redirect } from "next/navigation";

export default function PortalReservationRedirect({ params }: { params: { id: string } }) {
  // Redirect guests hitting deep links to the login flow so they can retrieve their reservation.
  redirect(`/portal/login?reservationId=${encodeURIComponent(params.id)}`);
}
