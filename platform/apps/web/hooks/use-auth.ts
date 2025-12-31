"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface SessionWithToken {
  apiToken?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  campgroundIds?: string[];
  organizationIds?: string[];
}

interface UseAuthReturn {
  user: User | null;
  campgroundId: string | null;
  organizationId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
}

/**
 * Combined auth hook that provides:
 * - User info from whoami/session
 * - Current campgroundId from localStorage
 * - Current organizationId from localStorage
 * - Auth token
 */
export function useAuth(): UseAuthReturn {
  const isBrowser = typeof window !== "undefined";
  const { data: session, status } = useSession();

  // State for localStorage values (handles hydration)
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Sync from localStorage on mount and changes
  useEffect(() => {
    if (!isBrowser) return;

    const syncFromStorage = () => {
      setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
      setOrganizationId(localStorage.getItem("campreserv:selectedOrg"));
      setToken(localStorage.getItem("campreserv:authToken"));
    };

    // Initial sync
    syncFromStorage();

    // Listen for storage changes (from other tabs or manual updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "campreserv:selectedCampground" ||
        e.key === "campreserv:selectedOrg" ||
        e.key === "campreserv:authToken"
      ) {
        syncFromStorage();
      }
    };

    // Listen for custom event for same-tab updates
    const handleCampgroundChange = () => {
      syncFromStorage();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("campground-changed", handleCampgroundChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("campground-changed", handleCampgroundChange);
    };
  }, [isBrowser]);

  // Get session token
  const sessionWithToken = session as SessionWithToken | null;
  const sessionToken = sessionWithToken?.apiToken;
  const effectiveToken = sessionToken || token;
  const hasAuth = Boolean(effectiveToken);

  // Fetch whoami for detailed user info
  const { data: whoami, isLoading: whoamiLoading } = useQuery({
    queryKey: ["auth-whoami"],
    queryFn: () => apiClient.getWhoami(effectiveToken || undefined),
    enabled: isBrowser && hasAuth,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Build user object from whoami or session
  const user = useMemo<User | null>(() => {
    if (whoami?.user) {
      const u = whoami.user;
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || undefined;
      return {
        id: u.id,
        email: u.email,
        name: fullName,
        role: u.platformRole || u.memberships?.[0]?.role,
        campgroundIds: u.memberships?.map((m) => m.campgroundId),
        organizationIds: u.ownershipRoles,
      };
    }

    if (sessionWithToken?.user) {
      return {
        id: sessionWithToken.user.id,
        email: sessionWithToken.user.email,
        name: sessionWithToken.user.name,
      };
    }

    return null;
  }, [whoami, sessionWithToken]);

  const isLoading = status === "loading" || (hasAuth && whoamiLoading);
  const isAuthenticated = Boolean(user || hasAuth);

  return {
    user,
    campgroundId,
    organizationId,
    isLoading,
    isAuthenticated,
    token: effectiveToken || null,
  };
}

export type { UseAuthReturn, User };
