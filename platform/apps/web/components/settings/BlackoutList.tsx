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
import { BlackoutModal } from "./BlackoutModal";
import { format } from "date-fns";
import { Site } from "@campreserv/shared";

interface BlackoutListProps {
    campgroundId: string;
}

export function BlackoutList({ campgroundId }: BlackoutListProps) {
    const qc = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const blackoutsQuery = useQuery({
        queryKey: ["blackouts", campgroundId],
        queryFn: () => apiClient.getBlackouts(campgroundId)
    });

    const sitesQuery = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId)
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiClient.createBlackout({ ...data, campgroundId }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["blackouts"] })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.deleteBlackout(id, campgroundId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["blackouts"] })
    });

    const handleSave = async (data: any) => {
        await createMutation.mutateAsync(data);
    };

    const blackouts = blackoutsQuery.data || [];
    const sites = sitesQuery.data || [];

    if (blackoutsQuery.isLoading) return <div className="text-slate-500">Loading blackout dates...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900">Blackout Dates</h3>
                <Button onClick={() => setIsModalOpen(true)}>Add Blackout Date</Button>
            </div>

            <div className="space-y-2">
                {blackouts.map((blackout) => (
                    <div key={blackout.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                        <div className="space-y-1">
                            <div className="font-medium text-slate-900">
                                {format(new Date(blackout.startDate), "MMM d, yyyy")} - {format(new Date(blackout.endDate), "MMM d, yyyy")}
                            </div>
                            <div className="text-sm text-slate-500">
                                {blackout.site ? (
                                    <span>Site: {blackout.site.name} ({blackout.site.siteNumber})</span>
                                ) : (
                                    <span className="font-medium text-amber-600">Entire Campground</span>
                                )}
                            </div>
                            {blackout.reason && <div className="text-sm text-slate-500 italic">{blackout.reason}</div>}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteConfirmId(blackout.id)}
                        >
                            Delete
                        </Button>
                    </div>
                ))}
                {blackouts.length === 0 && (
                    <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-lg">
                        No blackout dates found.
                    </div>
                )}
            </div>

            <BlackoutModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                sites={sites as Site[]}
                onSave={handleSave}
            />

            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Blackout Date</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this blackout date? This action cannot be undone.
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
