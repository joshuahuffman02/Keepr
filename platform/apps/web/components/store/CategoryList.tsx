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
import { CategoryModal } from "./CategoryModal";
import { ProductCategory } from "@campreserv/shared";
import { EmptyState } from "../ui/empty-state";
import { FolderOpen, Plus } from "lucide-react";

interface CategoryListProps {
    campgroundId: string;
}

export function CategoryList({ campgroundId }: CategoryListProps) {
    const qc = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const categoriesQuery = useQuery({
        queryKey: ["store-categories", campgroundId],
        queryFn: () => apiClient.getStoreCategories(campgroundId)
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiClient.createStoreCategory(campgroundId, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["store-categories"] })
    });

    const updateMutation = useMutation({
        mutationFn: (payload: { id: string; data: any }) =>
            apiClient.updateStoreCategory(payload.id, payload.data, campgroundId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["store-categories"] })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.deleteStoreCategory(id, campgroundId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["store-categories"] })
    });

    const handleSave = async (data: any) => {
        if (editingCategory) {
            await updateMutation.mutateAsync({ id: editingCategory.id, data });
        } else {
            await createMutation.mutateAsync(data);
        }
    };

    const handleEdit = (category: ProductCategory) => {
        setEditingCategory(category);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingCategory(null);
        setIsModalOpen(true);
    };

    const categories = categoriesQuery.data || [];

    if (categoriesQuery.isLoading) return <div className="text-muted-foreground">Loading categories...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-foreground">Categories</h3>
                <Button onClick={handleCreate}>Add Category</Button>
            </div>

            <div className="space-y-2">
                {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                        <div className="space-y-1">
                            <div className="font-medium text-foreground flex items-center gap-2">
                                {category.name}
                                {!category.isActive && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            {category.description && <div className="text-sm text-muted-foreground">{category.description}</div>}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => handleEdit(category)}>
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteConfirmId(category.id)}
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                ))}
                {categories.length === 0 && (
                    <EmptyState
                        icon={FolderOpen}
                        title="No categories yet"
                        description="Categories help organize your products and make them easier to find. Create categories like 'Food & Beverages', 'Camping Supplies', or 'Merchandise'."
                        action={{
                            label: "Create First Category",
                            onClick: handleCreate,
                            icon: Plus
                        }}
                    />
                )}
            </div>

            <CategoryModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                category={editingCategory}
                onSave={handleSave}
            />

            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this category? This action cannot be undone.
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
