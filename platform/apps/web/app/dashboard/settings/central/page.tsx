import { redirect } from "next/navigation";

// Redirect to the first category (Property)
export default function CentralSettingsPage() {
  redirect("/dashboard/settings/central/property");
}
