"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  Link2,
  Unlink,
  Download,
  Wand2,
  Search,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Package,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

// Type matching the API response
interface ProductMapping {
  id: string;
  campgroundId: string;
  productId: string;
  provider: string;
  externalId: string;
  externalSku: string | null;
  lastSyncedAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
  metadata: Record<string, any> | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    priceCents: number;
  };
}

// Type matching the API response for unmatched products
interface ExternalProduct {
  id: string;
  externalId: string;
  externalSku: string | null;
  metadata: Record<string, any> | null;
}

export default function ProductMappingsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const integrationId = params.integrationId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<ProductMapping | null>(null);
  const [selectedExternalId, setSelectedExternalId] = useState("");

  // Get campgroundId from localStorage
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("selectedCampgroundId");
    if (stored) setCampgroundId(stored);
  }, []);

  // Fetch integration details
  const { data: integration } = useQuery({
    queryKey: ["pos-integration", integrationId],
    queryFn: () => apiClient.getPosIntegration(integrationId),
    enabled: !!integrationId,
  });

  // Fetch product mappings
  const {
    data: mappings = [],
    isLoading: mappingsLoading,
    refetch: refetchMappings,
  } = useQuery({
    queryKey: ["product-mappings", campgroundId, integration?.provider],
    queryFn: () =>
      apiClient.listProductMappings(campgroundId!, integration?.provider),
    enabled: !!campgroundId && !!integration?.provider,
  });

  // Fetch unmatched external products
  const { data: externalProducts = [], isLoading: externalLoading } = useQuery({
    queryKey: ["external-products", integrationId],
    queryFn: () => apiClient.getUnmatchedExternalProducts(integrationId),
    enabled: !!integrationId && linkDialogOpen,
  });

  // Import external products mutation
  const importMutation = useMutation({
    mutationFn: () => apiClient.importExternalProducts(integrationId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["external-products"] });
      toast({
        title: "Products imported",
        description: `Imported ${result.imported} products from POS system.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-match products mutation
  const autoMatchMutation = useMutation({
    mutationFn: () => apiClient.autoMatchProducts(integrationId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product-mappings"] });
      toast({
        title: "Auto-match complete",
        description: `Matched ${result.matched} products by SKU.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Auto-match failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Link product mutation
  const linkMutation = useMutation({
    mutationFn: (payload: {
      campgroundId: string;
      productId: string;
      provider: string;
      externalId: string;
    }) => apiClient.linkProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["external-products"] });
      setLinkDialogOpen(false);
      setSelectedMapping(null);
      setSelectedExternalId("");
      toast({
        title: "Product linked",
        description: "The product has been linked to the external POS product.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Link failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unlink product mutation
  const unlinkMutation = useMutation({
    mutationFn: (mappingId: string) => apiClient.unlinkProduct(mappingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-mappings"] });
      toast({
        title: "Product unlinked",
        description: "The product mapping has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unlink failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter mappings based on search and tab
  const filteredMappings = (mappings as ProductMapping[]).filter((mapping) => {
    const matchesSearch =
      !searchQuery ||
      mapping.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mapping.product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mapping.externalId?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "mapped") return matchesSearch && mapping.externalId;
    if (activeTab === "unmatched") return matchesSearch && !mapping.externalId;
    return matchesSearch;
  });

  const getStatusBadge = (mapping: ProductMapping) => {
    if (!mapping.externalId) {
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
          <AlertCircle className="mr-1 h-3 w-3" />
          Not Linked
        </Badge>
      );
    }

    switch (mapping.syncStatus) {
      case "SYNCED":
        return (
          <Badge variant="outline" className="text-green-600 border-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            Synced
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-300">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            Syncing
          </Badge>
        );
      case "ERROR":
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-green-600 border-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            Linked
          </Badge>
        );
    }
  };

  const handleOpenLinkDialog = (mapping: ProductMapping) => {
    setSelectedMapping(mapping);
    setSelectedExternalId("");
    setLinkDialogOpen(true);
  };

  const handleLink = () => {
    if (selectedMapping && selectedExternalId && campgroundId && integration?.provider) {
      linkMutation.mutate({
        campgroundId,
        productId: selectedMapping.productId,
        provider: integration.provider,
        externalId: selectedExternalId,
      });
    }
  };

  const providerName =
    integration?.provider === "LIGHTSPEED"
      ? "Lightspeed"
      : integration?.provider === "SHOPIFY_POS"
      ? "Shopify"
      : integration?.provider === "VEND"
      ? "Vend"
      : integration?.provider || "POS";

  const typedMappings = mappings as ProductMapping[];
  const stats = {
    total: typedMappings.length,
    mapped: typedMappings.filter((m) => m.externalId).length,
    unmatched: typedMappings.filter((m) => !m.externalId).length,
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href={`/dashboard/settings/pos-integrations/${integrationId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Product Mappings</h1>
              <p className="text-muted-foreground">
                Link your products to {providerName} POS products
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Import from POS
            </Button>
            <Button
              onClick={() => autoMatchMutation.mutate()}
              disabled={autoMatchMutation.isPending}
            >
              {autoMatchMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Auto-Match by SKU
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mapped
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.mapped}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unmatched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{stats.unmatched}</p>
            </CardContent>
          </Card>
        </div>

        {/* Mappings Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Product Mappings</CardTitle>
                <CardDescription>
                  View and manage links between your products and {providerName}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs and Search */}
            <div className="flex items-center justify-between mb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                  <TabsTrigger value="mapped">Mapped ({stats.mapped})</TabsTrigger>
                  <TabsTrigger value="unmatched">
                    Unmatched ({stats.unmatched})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Table */}
            {mappingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No products match your search"
                    : "No products found. Import products from your POS system to get started."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>External SKU</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        {mapping.product.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {mapping.product.sku || "—"}
                      </TableCell>
                      <TableCell>
                        {mapping.externalId || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {mapping.externalSku || "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(mapping)}</TableCell>
                      <TableCell className="text-right">
                        {mapping.externalId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkMutation.mutate(mapping.id)}
                            disabled={unlinkMutation.isPending}
                          >
                            <Unlink className="mr-1 h-4 w-4" />
                            Unlink
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenLinkDialog(mapping)}
                          >
                            <Link2 className="mr-1 h-4 w-4" />
                            Link
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Link Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Link Product</DialogTitle>
              <DialogDescription>
                Select a {providerName} product to link with{" "}
                <strong>{selectedMapping?.product.name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Campreserv Product</p>
                <div className="rounded-lg border p-3 bg-muted/50">
                  <p className="font-medium">{selectedMapping?.product.name}</p>
                  {selectedMapping?.product.sku && (
                    <p className="text-sm text-muted-foreground">
                      SKU: {selectedMapping.product.sku}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{providerName} Product</p>
                {externalLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (externalProducts as ExternalProduct[]).length === 0 ? (
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No unlinked products found. Import products from {providerName} first.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setLinkDialogOpen(false);
                        importMutation.mutate();
                      }}
                    >
                      Import Products
                    </Button>
                  </div>
                ) : (
                  <Select value={selectedExternalId} onValueChange={setSelectedExternalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(externalProducts as ExternalProduct[]).map((product) => (
                        <SelectItem key={product.id} value={product.externalId}>
                          <div className="flex flex-col">
                            <span>ID: {product.externalId}</span>
                            {product.externalSku && (
                              <span className="text-xs text-muted-foreground">
                                SKU: {product.externalSku}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleLink}
                disabled={!selectedExternalId || linkMutation.isPending}
              >
                {linkMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Link Products
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
