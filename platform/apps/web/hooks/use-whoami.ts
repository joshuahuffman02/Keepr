import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSession } from "next-auth/react";

export function useWhoami() {
  const isBrowser = typeof window !== "undefined";
  const { data: session } = useSession();
  const token =
    isBrowser ? localStorage.getItem("campreserv:authToken") : null;
  const hasAuth = Boolean((session as any)?.apiToken || token);

  return useQuery({
    queryKey: ["permissions-whoami"],
    queryFn: () => apiClient.getWhoami(),
    enabled: isBrowser && hasAuth,
    staleTime: 5 * 60 * 1000,
    retry: false
  });
}
