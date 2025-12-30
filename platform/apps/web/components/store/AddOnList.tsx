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
import { AddOnModal } from "./AddOnModal";
import { AddOn } from "@campreserv/shared";

interface AddOnListProps {
    campgroundId: string;
}

export function AddOnList({ campgroundId }: AddOnListProps) {
    const qc = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const addOnsQuery = useQuery({
        queryKey: ["store-addons", campgroundId],
        queryFn: () => apiClient.getStoreAddOns(campgroundId)
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiClient.createStoreAddOn(campgroundId, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["store-addons"] })
    });

    const updateMutation = useMutation({
        mutationFn: (payload: { id: string; data: any }) => apiClient.updateStoreAddOn(payload.id, payload.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["store-addons"] })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.deleteStoreAddOn(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["store-addons"] })
    });

    const handleSave = async (data: any) => {
        if (editingAddOn) {
            await updateMutation.mutateAsync({ id: editingAddOn.id, data });
        } else {
            await createMutation.mutateAsync(data);
        }
    };

    const handleEdit = (addOn: AddOn) => {
        setEditingAddOn(addOn);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingAddOn(null);
        setIsModalOpen(true);
    };

    const addOns = addOnsQuery.data || [];

    if (addOnsQuery.isLoading) return <div className="text-slate-500">Loading add-ons...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900">Add-ons</h3>
                <Button onClick={handleCreate}>Add Add-on</Button>
            </div>

            <div className="space-y-2">
                {addOns.map((addOn) => (
                    <div key={addOn.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                        <div className="space-y-1">
                            <div className="font-medium text-slate-900 flex items-center gap-2">
                                {addOn.name}
                                {!addOn.isActive && (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-slate-500">
                                ${(addOn.priceCents / 100).toFixed(2)}
                                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    {addOn.pricingType === "flat"
                                        ? "Flat Fee"
                                        : addOn.pricingType === "per_night"
                                            ? "Per Night"
                                            : "Per Person"}
                                </span>
                            </div>
                            {addOn.description && <div className="text-sm text-slate-500">{addOn.description}</div>}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => handleEdit(addOn)}>
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteConfirmId(addOn.id)}
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                ))}
                {addOns.length === 0 && (
                    <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-lg">
                        No add-ons found. Create services like firewood, rentals, etc.
                    </div>
                )}
            </div>

            <AddOnModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                addOn={editingAddOn}
                onSave={handleSave}
            />

            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Add-on</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this add-on? This action cannot be undone.
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
