import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { ProductModal } from "./ProductModal";
import { ProductImportExport } from "./ProductImportExport";
import type { CreateProductDto, Product, ProductCategory } from "@keepr/shared";
import { EmptyState } from "../ui/empty-state";
import { Package, Plus } from "lucide-react";

interface ProductListProps {
  campgroundId: string;
}

type ProductPayload = Omit<CreateProductDto, "campgroundId">;

export function ProductList({ campgroundId }: ProductListProps) {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["store-products", campgroundId],
    queryFn: () => apiClient.getStoreProducts(campgroundId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["store-categories", campgroundId],
    queryFn: () => apiClient.getStoreCategories(campgroundId),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProductPayload) => apiClient.createStoreProduct(campgroundId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store-products"] }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<ProductPayload> }) =>
      apiClient.updateStoreProduct(payload.id, payload.data, campgroundId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store-products"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteStoreProduct(id, campgroundId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store-products"] }),
  });

  const handleSave = async (data: ProductPayload) => {
    if (editingProduct) {
      await updateMutation.mutateAsync({ id: editingProduct.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const categories = categoriesQuery.data || [];
  const products = productsQuery.data || [];

  if (productsQuery.isLoading)
    return <div className="text-muted-foreground">Loading products...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-foreground">Products</h3>
        <div className="flex items-center gap-3">
          <ProductImportExport campgroundId={campgroundId} />
          <Button onClick={handleCreate}>Add Product</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => {
          const category = categories.find((c) => c.id === product.categoryId);
          return (
            <div key={product.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    ${(product.priceCents / 100).toFixed(2)}
                  </div>
                </div>
                {!product.isActive && (
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>

              {product.imageUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="text-sm text-muted-foreground space-y-1">
                {category && <div>Category: {category.name}</div>}
                <div>Stock: {product.trackInventory ? product.stockQty : "Unlimited"}</div>
                {product.sku && <div>SKU: {product.sku}</div>}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => handleEdit(product)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteConfirmId(product.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Create your first product to start selling items at your campground. Products can include firewood, merchandise, snacks, and more."
              action={{
                label: "Create First Product",
                onClick: handleCreate,
                icon: Plus,
              }}
            />
          </div>
        )}
      </div>

      <ProductModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        product={editingProduct}
        categories={categories}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  deleteMutation.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
