import { redirect } from "next/navigation";

export default function SystemPage() {
  redirect("/dashboard/settings/central/system/check");
}
