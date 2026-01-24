import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef } from "react";
import { useWhoami } from "./use-whoami";
import { getDefaultMenuForRole, inferRoleFromPermissions } from "@/lib/default-menus";

export interface MenuConfig {
  id: string;
  userId: string;
  pinnedPages: string[];
  sidebarCollapsed: boolean;
  migratedFromLocal: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SessionWithToken {
  apiToken?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

async function fetchWithAuth<T>(
  endpoint: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Hook for managing user's customizable sidebar menu
 */
export function useMenuConfig() {
  const isBrowser = typeof window !== "undefined";
  const { data: session } = useSession();
  const { data: whoami } = useWhoami();
  const queryClient = useQueryClient();
  const migrationAttempted = useRef(false);

  const token = isBrowser ? localStorage.getItem("campreserv:authToken") : null;
  const hasApiToken = (value: unknown): value is SessionWithToken =>
    typeof value === "object" && value !== null && "apiToken" in value;
  const sessionToken =
    hasApiToken(session) && typeof session.apiToken === "string" ? session.apiToken : undefined;
  const authToken = sessionToken || token || "";
  const hasAuth = Boolean(authToken);

  // Get selected campground for dynamic page resolution
  const selectedCampground = isBrowser
    ? localStorage.getItem("campreserv:selectedCampground")
    : null;

  // Infer user's role from permissions
  const permissions = whoami?.allowed || {};
  const platformRole = whoami?.user?.platformRole || null;
  const inferredRole = inferRoleFromPermissions(permissions, platformRole);

  // Fetch menu config from API
  const {
    data: config,
    isLoading,
    error,
    refetch,
  } = useQuery<MenuConfig>({
    queryKey: ["menu-config"],
    queryFn: () => fetchWithAuth<MenuConfig>("/menu-config", authToken),
    enabled: isBrowser && hasAuth,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Migrate from localStorage on first load
  useEffect(() => {
    if (!isBrowser || !hasAuth || !config || migrationAttempted.current) return;
    if (config.migratedFromLocal) return;

    migrationAttempted.current = true;

    // Check for existing localStorage data
    const storedFavorites = localStorage.getItem("campreserv:nav:favorites");
    if (!storedFavorites) return;

    try {
      const favorites: string[] = JSON.parse(storedFavorites);
      if (favorites.length > 0) {
        // Migrate to server
        fetchWithAuth<MenuConfig>("/menu-config/migrate-local", authToken, {
          method: "POST",
          body: JSON.stringify({
            pinnedPages: favorites,
            sidebarCollapsed: false,
          }),
        }).then(() => {
          // Clear localStorage after successful migration
          localStorage.removeItem("campreserv:nav:favorites");
          localStorage.removeItem("campreserv:nav:visits");
          refetch();
        });
      }
    } catch {
      // Ignore parse errors
    }
  }, [isBrowser, hasAuth, config, authToken, refetch]);

  // Pin page mutation
  const pinMutation = useMutation({
    mutationFn: (href: string) =>
      fetchWithAuth<MenuConfig>("/menu-config/pin", authToken, {
        method: "POST",
        body: JSON.stringify({ href }),
      }),
    onMutate: async (href) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["menu-config"] });
      const previous = queryClient.getQueryData<MenuConfig>(["menu-config"]);
      if (previous) {
        queryClient.setQueryData<MenuConfig>(["menu-config"], {
          ...previous,
          pinnedPages: [href, ...previous.pinnedPages.filter((p) => p !== href)].slice(0, 20),
        });
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["menu-config"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-config"] });
    },
  });

  // Unpin page mutation
  const unpinMutation = useMutation({
    mutationFn: (href: string) =>
      fetchWithAuth<MenuConfig>(`/menu-config/pin/${encodeURIComponent(href)}`, authToken, {
        method: "DELETE",
      }),
    onMutate: async (href) => {
      await queryClient.cancelQueries({ queryKey: ["menu-config"] });
      const previous = queryClient.getQueryData<MenuConfig>(["menu-config"]);
      if (previous) {
        queryClient.setQueryData<MenuConfig>(["menu-config"], {
          ...previous,
          pinnedPages: previous.pinnedPages.filter((p) => p !== href),
        });
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["menu-config"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-config"] });
    },
  });

  // Reorder pages mutation
  const reorderMutation = useMutation({
    mutationFn: (pinnedPages: string[]) =>
      fetchWithAuth<MenuConfig>("/menu-config/reorder", authToken, {
        method: "POST",
        body: JSON.stringify({ pinnedPages }),
      }),
    onMutate: async (pinnedPages) => {
      await queryClient.cancelQueries({ queryKey: ["menu-config"] });
      const previous = queryClient.getQueryData<MenuConfig>(["menu-config"]);
      if (previous) {
        queryClient.setQueryData<MenuConfig>(["menu-config"], {
          ...previous,
          pinnedPages,
        });
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["menu-config"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-config"] });
    },
  });

  // Reset to defaults mutation
  const resetMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<MenuConfig>("/menu-config/reset", authToken, {
        method: "POST",
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-config"] });
    },
  });

  // Update sidebar collapsed state
  const updateCollapsedMutation = useMutation({
    mutationFn: (sidebarCollapsed: boolean) =>
      fetchWithAuth<MenuConfig>("/menu-config", authToken, {
        method: "PATCH",
        body: JSON.stringify({ sidebarCollapsed }),
      }),
    onMutate: async (sidebarCollapsed) => {
      await queryClient.cancelQueries({ queryKey: ["menu-config"] });
      const previous = queryClient.getQueryData<MenuConfig>(["menu-config"]);
      if (previous) {
        queryClient.setQueryData<MenuConfig>(["menu-config"], {
          ...previous,
          sidebarCollapsed,
        });
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["menu-config"], context.previous);
      }
    },
  });

  // Get effective pinned pages (from config or role defaults)
  const getEffectivePinnedPages = useCallback((): string[] => {
    if (config?.pinnedPages && config.pinnedPages.length > 0) {
      return config.pinnedPages;
    }
    // Return role-based defaults
    return getDefaultMenuForRole(inferredRole, selectedCampground || undefined);
  }, [config, inferredRole, selectedCampground]);

  // Check if a page is pinned
  const isPinned = useCallback(
    (href: string): boolean => {
      const pinnedPages = getEffectivePinnedPages();
      return pinnedPages.includes(href);
    },
    [getEffectivePinnedPages],
  );

  // Toggle pin state
  const togglePin = useCallback(
    (href: string) => {
      if (isPinned(href)) {
        unpinMutation.mutate(href);
      } else {
        pinMutation.mutate(href);
      }
    },
    [isPinned, pinMutation, unpinMutation],
  );

  return {
    // Config data
    config,
    pinnedPages: getEffectivePinnedPages(),
    sidebarCollapsed: config?.sidebarCollapsed ?? false,
    isLoading,
    error,

    // Actions
    pinPage: (href: string) => pinMutation.mutate(href),
    unpinPage: (href: string) => unpinMutation.mutate(href),
    togglePin,
    reorderPages: (pages: string[]) => reorderMutation.mutate(pages),
    resetToDefaults: () => resetMutation.mutate(),
    setSidebarCollapsed: (collapsed: boolean) => updateCollapsedMutation.mutate(collapsed),

    // Helpers
    isPinned,
    inferredRole,
    hasCustomPins: (config?.pinnedPages?.length ?? 0) > 0,
  };
}
