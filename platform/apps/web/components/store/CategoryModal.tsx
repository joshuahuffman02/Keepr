import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { CreateProductCategoryDto, ProductCategory } from "@keepr/shared";

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: ProductCategory | null;
  onSave: (data: CategoryPayload) => Promise<void>;
}

type CategoryPayload = Omit<CreateProductCategoryDto, "campgroundId">;
type CategoryFormData = {
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

export function CategoryModal({ open, onOpenChange, category, onSave }: CategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    if (open) {
      if (category) {
        setFormData({
          name: category.name,
          description: category.description || "",
          sortOrder: category.sortOrder || 0,
          isActive: category.isActive ?? true,
        });
      } else {
        setFormData({
          name: "",
          description: "",
          sortOrder: 0,
          isActive: true,
        });
      }
    }
  }, [open, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        sortOrder: Number(formData.sortOrder),
        description: formData.description.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-600"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
