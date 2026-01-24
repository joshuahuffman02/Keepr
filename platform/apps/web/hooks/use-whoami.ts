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

type WhoamiResponse = Awaited<ReturnType<typeof apiClient.getWhoami>>;

const hasApiToken = (value: unknown): value is SessionWithToken =>
  typeof value === "object" && value !== null && "apiToken" in value;

export function useWhoami() {
  const isBrowser = typeof window !== "undefined";
  const { data: session } = useSession();
  const token = isBrowser ? localStorage.getItem("campreserv:authToken") : null;
  const sessionToken =
    hasApiToken(session) && typeof session.apiToken === "string" ? session.apiToken : undefined;
  const hasAuth = Boolean(sessionToken || token);

  return useQuery<WhoamiResponse>({
    queryKey: ["permissions-whoami"],
    queryFn: () => apiClient.getWhoami(sessionToken || token || undefined),
    enabled: isBrowser && hasAuth,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
