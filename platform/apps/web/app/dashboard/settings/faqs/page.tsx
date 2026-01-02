"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCampground } from "@/contexts/CampgroundContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
    Plus,
    Trash2,
    GripVertical,
    ChevronUp,
    ChevronDown,
    HelpCircle,
    Save,
    AlertCircle
} from "lucide-react";

type FAQ = {
    id: string;
    question: string;
    answer: string;
    order: number;
};

export default function FAQsPage() {
    const { selectedCampground, isHydrated } = useCampground();
    const campgroundId = selectedCampground?.id;
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId!),
        enabled: !!campgroundId,
    });

    useEffect(() => {
        const cg: any = campgroundQuery.data;
        if (!cg) return;
        const existingFaqs = (cg.faqs as FAQ[]) || [];
        setFaqs(existingFaqs.sort((a, b) => a.order - b.order));
        setHasChanges(false);
    }, [campgroundQuery.data]);

    const saveMutation = useMutation({
        mutationFn: () =>
            apiClient.updateCampgroundFaqs(campgroundId!, faqs.map((faq, idx) => ({ ...faq, order: idx }))),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campground", campgroundId] });
            toast({ title: "FAQs saved successfully" });
            setHasChanges(false);
        },
        onError: () => toast({ title: "Failed to save FAQs", variant: "destructive" }),
    });

    const addFaq = () => {
        const newFaq: FAQ = {
            id: `faq-${Date.now()}`,
            question: "",
            answer: "",
            order: faqs.length
        };
        setFaqs([...faqs, newFaq]);
        setHasChanges(true);
    };

    const updateFaq = (id: string, field: "question" | "answer", value: string) => {
        setFaqs(faqs.map(faq => faq.id === id ? { ...faq, [field]: value } : faq));
        setHasChanges(true);
    };

    const deleteFaq = (id: string) => {
        setFaqs(faqs.filter(faq => faq.id !== id));
        setHasChanges(true);
    };

    const moveFaq = (id: string, direction: "up" | "down") => {
        const idx = faqs.findIndex(faq => faq.id === id);
        if (direction === "up" && idx > 0) {
            const newFaqs = [...faqs];
            [newFaqs[idx - 1], newFaqs[idx]] = [newFaqs[idx], newFaqs[idx - 1]];
            setFaqs(newFaqs);
            setHasChanges(true);
        } else if (direction === "down" && idx < faqs.length - 1) {
            const newFaqs = [...faqs];
            [newFaqs[idx], newFaqs[idx + 1]] = [newFaqs[idx + 1], newFaqs[idx]];
            setFaqs(newFaqs);
            setHasChanges(true);
        }
    };

    const isValid = faqs.every(faq => faq.question.trim() && faq.answer.trim());

    // Wait for hydration before showing content to avoid hydration mismatch
    if (!isHydrated || campgroundQuery.isLoading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
        );
    }

    // Show campground selection prompt after hydration confirms no campground
    if (!campgroundId) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
                    <HelpCircle className="w-12 h-12 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Select a Campground</h1>
                <p className="text-muted-foreground max-w-md">
                    Please select a campground to manage FAQs.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">FAQs</h1>
                        <p className="text-muted-foreground mt-1">
                            Frequently asked questions displayed on your public booking page
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={addFaq}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add FAQ
                        </Button>
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={!hasChanges || !isValid || saveMutation.isPending}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saveMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>

                {!isValid && faqs.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <p className="text-sm text-amber-800">
                            All FAQs must have both a question and answer before saving.
                        </p>
                    </div>
                )}

                {faqs.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No FAQs yet</h3>
                            <p className="text-muted-foreground mb-6">
                                Add frequently asked questions to help guests before they book.
                            </p>
                            <Button onClick={addFaq}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Your First FAQ
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {faqs.map((faq, idx) => (
                            <Card key={faq.id}>
                                <CardContent className="pt-6">
                                    <div className="flex gap-4">
                                        {/* Reorder Controls */}
                                        <div className="flex flex-col items-center gap-1 pt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => moveFaq(faq.id, "up")}
                                                disabled={idx === 0}
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </Button>
                                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => moveFaq(faq.id, "down")}
                                                disabled={idx === faqs.length - 1}
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        {/* FAQ Content */}
                                        <div className="flex-1 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-foreground mb-1">
                                                    Question
                                                </label>
                                                <Input
                                                    value={faq.question}
                                                    onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                                                    placeholder="e.g., What time is check-in?"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-foreground mb-1">
                                                    Answer
                                                </label>
                                                <Textarea
                                                    value={faq.answer}
                                                    onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                                                    placeholder="e.g., Check-in begins at 3:00 PM. Early check-in may be available upon request."
                                                    rows={3}
                                                />
                                            </div>
                                        </div>

                                        {/* Delete Button */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                            onClick={() => deleteFaq(faq.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Preview Section */}
                {faqs.length > 0 && faqs.some(f => f.question && f.answer) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Preview</CardTitle>
                            <CardDescription>How FAQs will appear on your booking page</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 bg-muted rounded-lg p-4">
                                {faqs.filter(f => f.question && f.answer).map((faq) => (
                                    <div key={faq.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                                        <h4 className="font-medium text-foreground mb-1">{faq.question}</h4>
                                        <p className="text-sm text-muted-foreground">{faq.answer}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
