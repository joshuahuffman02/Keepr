"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
    Plug,
    Search,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Settings2,
    Sparkles
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { IntegrationDetailModal } from "@/components/integrations/IntegrationDetailModal";
import {
    INTEGRATIONS_DIRECTORY,
    INTEGRATION_CATEGORIES,
    type IntegrationDefinition,
    type IntegrationCategory
} from "@/lib/integrations-directory";
import { cn } from "@/lib/utils";

const SPRING_CONFIG = {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
};

type ConnectionStatus = "connected" | "error" | "pending" | "disconnected";

interface Connection {
    id: string;
    provider: string;
    type: string;
    status: string;
    lastSyncAt?: string | null;
    lastError?: string | null;
}

export default function IntegrationsSettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [campgroundId, setCampgroundId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIntegration, setSelectedIntegration] = useState<IntegrationDefinition | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const stored = typeof window !== "undefined"
            ? localStorage.getItem("campreserv:selectedCampground")
            : null;
        if (stored) {
            setCampgroundId(stored);
        }
    }, []);

    // Fetch existing connections
    const connectionsQuery = useQuery({
        queryKey: ["integrations", campgroundId],
        queryFn: () => apiClient.listIntegrationConnections(campgroundId),
        enabled: !!campgroundId
    });

    // Map connections by provider
    const connectionsByProvider = useMemo(() => {
        const map = new Map<string, Connection>();
        if (connectionsQuery.data) {
            for (const conn of connectionsQuery.data) {
                map.set(conn.provider, conn as Connection);
            }
        }
        return map;
    }, [connectionsQuery.data]);

    // Filter integrations by search
    const filteredIntegrations = useMemo(() => {
        if (!searchQuery.trim()) return INTEGRATIONS_DIRECTORY;
        const query = searchQuery.toLowerCase();
        return INTEGRATIONS_DIRECTORY.filter(
            (i) =>
                i.name.toLowerCase().includes(query) ||
                i.description.toLowerCase().includes(query) ||
                i.category.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    // Group by category
    const integrationsByCategory = useMemo(() => {
        const grouped: Record<IntegrationCategory, IntegrationDefinition[]> = {
            accounting: [],
            crm: [],
            access_control: [],
            export: []
        };
        for (const integration of filteredIntegrations) {
            grouped[integration.category].push(integration);
        }
        return grouped;
    }, [filteredIntegrations]);

    // Connected integrations
    const connectedIntegrations = useMemo(() => {
        return INTEGRATIONS_DIRECTORY.filter((i) => {
            const conn = connectionsByProvider.get(i.id);
            return conn && conn.status === "connected";
        });
    }, [connectionsByProvider]);

    // Mutations
    const connectMutation = useMutation({
        mutationFn: async (provider: string) => {
            // For now, create a basic connection
            // In production, this would initiate OAuth flow
            return apiClient.upsertIntegrationConnection({
                campgroundId,
                type: getIntegrationType(provider),
                provider,
                status: "connected",
                authType: "oauth"
            });
        },
        onSuccess: (_, provider) => {
            toast({
                title: "Integration connected!",
                description: `${getIntegrationName(provider)} is now syncing with your campground.`
            });
            queryClient.invalidateQueries({ queryKey: ["integrations", campgroundId] });
        },
        onError: (err: Error) => {
            toast({
                title: "Connection failed",
                description: err.message || "Please try again.",
                variant: "destructive"
            });
        }
    });

    const syncMutation = useMutation({
        mutationFn: (connectionId: string) =>
            apiClient.triggerIntegrationSync(connectionId, { note: "Manual sync" }),
        onSuccess: () => {
            toast({ title: "Sync started", description: "Data is being synced now." });
            queryClient.invalidateQueries({ queryKey: ["integrations", campgroundId] });
        },
        onError: (err: Error) => {
            toast({
                title: "Sync failed",
                description: err.message || "Please try again.",
                variant: "destructive"
            });
        }
    });

    const getConnectionStatus = (provider: string): ConnectionStatus | null => {
        const conn = connectionsByProvider.get(provider);
        if (!conn) return null;
        if (conn.status === "connected") return "connected";
        if (conn.status === "error" || conn.lastError) return "error";
        if (conn.status === "pending") return "pending";
        return "disconnected";
    };

    const getConnectionLastSync = (provider: string): string | null => {
        const conn = connectionsByProvider.get(provider);
        return conn?.lastSyncAt || null;
    };

    const handleConnect = (integration: IntegrationDefinition) => {
        setSelectedIntegration(integration);
        setIsModalOpen(true);
    };

    const handleManage = (integration: IntegrationDefinition) => {
        setSelectedIntegration(integration);
        setIsModalOpen(true);
    };

    const handleModalConnect = async () => {
        if (!selectedIntegration) return;
        await connectMutation.mutateAsync(selectedIntegration.id);
    };

    const handleModalSync = async () => {
        if (!selectedIntegration) return;
        const conn = connectionsByProvider.get(selectedIntegration.id);
        if (conn) {
            await syncMutation.mutateAsync(conn.id);
        }
    };

    const handleModalDisconnect = async () => {
        if (!selectedIntegration) return;
        const conn = connectionsByProvider.get(selectedIntegration.id);
        if (conn) {
            // Would call disconnect API
            toast({ title: "Integration disconnected" });
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["integrations", campgroundId] });
        }
    };

    return (
        <div className="space-y-8">
            <Breadcrumbs items={[{ label: "Settings" }, { label: "Integrations" }]} />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING_CONFIG}
                className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
            >
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                            <Plug className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Integrations
                            </h1>
                            <p className="text-muted-foreground">
                                Connect your campground with the tools you already use
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Connected integrations summary */}
            {connectedIntegrations.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.05 }}
                    className="rounded-xl border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 p-4"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-emerald-900 dark:text-emerald-100">
                                {connectedIntegrations.length} integration{connectedIntegrations.length > 1 ? "s" : ""} connected
                            </h3>
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                {connectedIntegrations.map((i) => i.name).join(", ")}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                            onClick={() => {
                                if (connectedIntegrations[0]) {
                                    handleManage(connectedIntegrations[0]);
                                }
                            }}
                        >
                            <Settings2 className="h-4 w-4 mr-1" />
                            Manage
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Search */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_CONFIG, delay: 0.1 }}
                className="relative"
            >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search integrations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </motion.div>

            {/* Loading state */}
            {connectionsQuery.isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* No campground selected */}
            {!campgroundId && !connectionsQuery.isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border-2 border-dashed border-muted p-12 text-center"
                >
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">
                        No campground selected
                    </h3>
                    <p className="text-muted-foreground mt-1">
                        Please select a campground from the sidebar to manage integrations.
                    </p>
                </motion.div>
            )}

            {/* Empty search results */}
            {campgroundId && filteredIntegrations.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border-2 border-dashed border-muted p-12 text-center"
                >
                    <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">
                        No integrations found
                    </h3>
                    <p className="text-muted-foreground mt-1">
                        Try a different search term.
                    </p>
                </motion.div>
            )}

            {/* Integration categories */}
            {campgroundId && !connectionsQuery.isLoading && filteredIntegrations.length > 0 && (
                <div className="space-y-10">
                    {(Object.entries(integrationsByCategory) as [IntegrationCategory, IntegrationDefinition[]][]).map(
                        ([category, integrations], categoryIndex) => {
                            if (integrations.length === 0) return null;
                            const categoryInfo = INTEGRATION_CATEGORIES[category];

                            return (
                                <motion.section
                                    key={category}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ ...SPRING_CONFIG, delay: 0.15 + categoryIndex * 0.05 }}
                                >
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold text-foreground">
                                            {categoryInfo.label}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {categoryInfo.description}
                                        </p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {integrations.map((integration, index) => (
                                            <motion.div
                                                key={integration.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    ...SPRING_CONFIG,
                                                    delay: 0.2 + categoryIndex * 0.05 + index * 0.03
                                                }}
                                            >
                                                <IntegrationCard
                                                    integration={integration}
                                                    status={getConnectionStatus(integration.id)}
                                                    lastSyncedAt={getConnectionLastSync(integration.id)}
                                                    onConnect={() => handleConnect(integration)}
                                                    onManage={() => handleManage(integration)}
                                                />
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.section>
                            );
                        }
                    )}
                </div>
            )}

            {/* Empty state - no integrations connected yet */}
            {campgroundId &&
                !connectionsQuery.isLoading &&
                connectedIntegrations.length === 0 &&
                !searchQuery && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_CONFIG, delay: 0.3 }}
                        className="mt-8 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 p-6 text-center"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 mx-auto mb-4">
                            <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                            Connect your first integration
                        </h3>
                        <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                            Link CampReserv with QuickBooks, Xero, or your CRM to keep everything in sync automatically.
                        </p>
                    </motion.div>
                )}

            {/* Integration detail modal */}
            <IntegrationDetailModal
                integration={selectedIntegration}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedIntegration(null);
                }}
                status={selectedIntegration ? getConnectionStatus(selectedIntegration.id) : null}
                lastSyncedAt={selectedIntegration ? getConnectionLastSync(selectedIntegration.id) : null}
                onConnect={handleModalConnect}
                onDisconnect={handleModalDisconnect}
                onSync={handleModalSync}
            />
        </div>
    );
}

function getIntegrationType(provider: string): "accounting" | "crm" | "access_control" | "export" {
    const integration = INTEGRATIONS_DIRECTORY.find((i) => i.id === provider);
    return integration?.category || "export";
}

function getIntegrationName(provider: string): string {
    const integration = INTEGRATIONS_DIRECTORY.find((i) => i.id === provider);
    return integration?.name || provider;
}
