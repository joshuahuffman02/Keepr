import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSession } from "next-auth/react";

interface SessionWithToken {
  apiToken?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export function useWhoami() {
  const isBrowser = typeof window !== "undefined";
  const { data: session } = useSession();
  const token = isBrowser ? localStorage.getItem("campreserv:authToken") : null;
  const sessionWithToken = session as SessionWithToken | null;
  const sessionToken = sessionWithToken?.apiToken;
  const hasAuth = Boolean(sessionToken || token);

  return useQuery({
    queryKey: ["permissions-whoami"],
    queryFn: () => apiClient.getWhoami(sessionToken || token || undefined),
    enabled: isBrowser && hasAuth,
    staleTime: 5 * 60 * 1000,
    retry: false
  });
}
