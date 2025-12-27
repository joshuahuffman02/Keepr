import { redirect } from "next/navigation";

export default function AccessPage() {
  redirect("/dashboard/settings/central/access/users");
}
