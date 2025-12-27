import { redirect } from "next/navigation";

// Redirect to the first section (Profile)
export default function PropertyPage() {
  redirect("/dashboard/settings/central/property/profile");
}
