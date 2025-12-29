import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export interface FeatureProgressItem {
  featureKey: string;
  completed: boolean;
  completedAt: string | null;
  notes: string | null;
}

export interface FeatureStats {
  completed: number;
  total: number;
  percentage: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

async function fetchWithAuth<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
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
 * Hook for managing user's feature discovery progress
 */
interface SessionWithToken {
  apiToken?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export function useFeatureProgress() {
  const isBrowser = typeof window !== "undefined";
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const token = isBrowser ? localStorage.getItem("campreserv:authToken") : null;
  const sessionToken = (session as SessionWithToken | null)?.apiToken;
  const authToken = sessionToken || token || "";
  const hasAuth = Boolean(authToken);

  // Fetch all progress
  const {
    data: progress,
    isLoading,
    error,
    refetch,
  } = useQuery<FeatureProgressItem[]>({
    queryKey: ["feature-progress"],
    queryFn: () => fetchWithAuth<FeatureProgressItem[]>("/feature-progress", authToken),
    enabled: isBrowser && hasAuth,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Fetch stats
  const { data: stats } = useQuery<FeatureStats>({
    queryKey: ["feature-progress", "stats"],
    queryFn: () => fetchWithAuth<FeatureStats>("/feature-progress/stats", authToken),
    enabled: isBrowser && hasAuth,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Toggle feature mutation
  const toggleMutation = useMutation({
    mutationFn: (featureKey: string) =>
      fetchWithAuth<FeatureProgressItem>(`/feature-progress/${encodeURIComponent(featureKey)}/toggle`, authToken, {
        method: "POST",
      }),
    onMutate: async (featureKey) => {
      await queryClient.cancelQueries({ queryKey: ["feature-progress"] });
      const previous = queryClient.getQueryData<FeatureProgressItem[]>(["feature-progress"]);

      if (previous) {
        const existing = previous.find((p) => p.featureKey === featureKey);
        if (existing) {
          queryClient.setQueryData<FeatureProgressItem[]>(["feature-progress"],
            previous.map((p) =>
              p.featureKey === featureKey
                ? { ...p, completed: !p.completed, completedAt: p.completed ? null : new Date().toISOString() }
                : p
            )
          );
        } else {
          queryClient.setQueryData<FeatureProgressItem[]>(["feature-progress"], [
            ...previous,
            { featureKey, completed: true, completedAt: new Date().toISOString(), notes: null },
          ]);
        }
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feature-progress"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-progress"] });
    },
  });

  // Mark complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: ({ featureKey, notes }: { featureKey: string; notes?: string }) =>
      fetchWithAuth<FeatureProgressItem>(`/feature-progress/${encodeURIComponent(featureKey)}/complete`, authToken, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-progress"] });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (updates: Array<{ featureKey: string; completed: boolean }>) =>
      fetchWithAuth<FeatureProgressItem[]>("/feature-progress/bulk", authToken, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-progress"] });
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<{ success: boolean }>("/feature-progress/reset", authToken, {
        method: "DELETE",
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-progress"] });
    },
  });

  // Check if a feature is completed
  const isCompleted = (featureKey: string): boolean => {
    return progress?.find((p) => p.featureKey === featureKey)?.completed ?? false;
  };

  // Get completed count
  const completedCount = progress?.filter((p) => p.completed).length ?? 0;

  return {
    // Data
    progress: progress ?? [],
    stats: stats ?? { completed: 0, total: 0, percentage: 0 },
    isLoading,
    error,
    completedCount,

    // Actions
    toggleFeature: (featureKey: string) => toggleMutation.mutate(featureKey),
    markComplete: (featureKey: string, notes?: string) =>
      markCompleteMutation.mutate({ featureKey, notes }),
    bulkUpdate: (updates: Array<{ featureKey: string; completed: boolean }>) =>
      bulkUpdateMutation.mutate(updates),
    reset: () => resetMutation.mutate(),
    refetch,

    // Helpers
    isCompleted,
    isToggling: toggleMutation.isPending,
  };
}
