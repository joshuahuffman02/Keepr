"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCampground } from "@/contexts/CampgroundContext";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Star,
    ThumbsUp,
    ThumbsDown,
    CheckCircle,
    XCircle,
    Clock,
    MessageSquare,
    Search,
    Filter,
    ChevronDown,
    Send,
    AlertCircle
} from "lucide-react";

type Review = {
    id: string;
    rating: number;
    title?: string;
    body?: string;
    status: string;
    helpfulCount?: number;
    unhelpfulCount?: number;
    ownerReply?: string;
    ownerReplyAt?: string;
    createdAt: string;
    guest?: {
        primaryFirstName?: string;
        primaryLastName?: string;
    };
    reservation?: {
        arrivalDate: string;
        departureDate: string;
        site?: { name: string };
    };
};

export default function ReviewsPage() {
    const { selectedCampground, isHydrated } = useCampground();
    const campgroundId = selectedCampground?.id;
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");

    const { data, isLoading, error } = useQuery({
        queryKey: ["reviews", campgroundId, statusFilter],
        queryFn: () => apiClient.getAdminReviews(campgroundId!, statusFilter === "all" ? undefined : statusFilter),
        enabled: !!campgroundId
    });

    const moderateMutation = useMutation({
        mutationFn: (params: { reviewId: string; action: "approve" | "reject" }) =>
            apiClient.moderateReview({
                reviewId: params.reviewId,
                status: params.action === "approve" ? "approved" : "rejected"
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reviews"] });
        }
    });

    const replyMutation = useMutation({
        mutationFn: (params: { reviewId: string; body: string }) =>
            apiClient.replyReview({
                reviewId: params.reviewId,
                authorType: "staff",
                body: params.body
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reviews"] });
            setReplyingTo(null);
            setReplyText("");
        }
    });

    const reviews: Review[] = (data as Review[]) || [];

    const filteredReviews = reviews.filter((review) => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesTitle = review.title?.toLowerCase().includes(query);
            const matchesBody = review.body?.toLowerCase().includes(query);
            const matchesGuest = `${review.guest?.primaryFirstName} ${review.guest?.primaryLastName}`.toLowerCase().includes(query);
            if (!matchesTitle && !matchesBody && !matchesGuest) return false;
        }
        return true;
    });

    const stats = {
        total: reviews.length,
        pending: reviews.filter((r) => r.status === "pending").length,
        approved: reviews.filter((r) => r.status === "approved").length,
        rejected: reviews.filter((r) => r.status === "rejected").length,
        avgRating: reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : "N/A"
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return <Badge variant="warning" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
            case "approved":
                return <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</Badge>;
            case "rejected":
                return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const renderStars = (rating: number) => (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={`w-4 h-4 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                />
            ))}
        </div>
    );

    // Wait for hydration before showing content to avoid hydration mismatch
    if (!isHydrated) {
        return (
            <DashboardShell>
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
            </DashboardShell>
        );
    }

    // Show campground selection prompt after hydration confirms no campground
    if (!campgroundId) {
        return (
            <DashboardShell>
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
                        <MessageSquare className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Select a Campground</h1>
                    <p className="text-muted-foreground max-w-md">
                        Please select a campground to manage reviews.
                    </p>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
                    <p className="text-muted-foreground mt-1">Manage and respond to guest reviews</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-foreground">{stats.avgRating}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Avg Rating
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                            <div className="text-sm text-muted-foreground">Total Reviews</div>
                        </CardContent>
                    </Card>
                    <Card className={stats.pending > 0 ? "border-amber-200 bg-amber-50" : ""}>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                            <div className="text-sm text-muted-foreground">Pending</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-emerald-600">{stats.approved}</div>
                            <div className="text-sm text-muted-foreground">Approved</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-muted-foreground">{stats.rejected}</div>
                            <div className="text-sm text-muted-foreground">Rejected</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search reviews..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex gap-2">
                        {["all", "pending", "approved", "rejected"].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                                className="capitalize"
                            >
                                {status}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Reviews List */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                    </div>
                ) : error ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Failed to load reviews</p>
                        </CardContent>
                    </Card>
                ) : filteredReviews.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">
                                {reviews.length === 0 ? "No reviews yet" : "No reviews match your filters"}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {filteredReviews.map((review) => (
                            <Card key={review.id} className={review.status === "pending" ? "border-amber-200" : ""}>
                                <CardContent className="pt-6">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            {/* Header */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {renderStars(review.rating)}
                                                {getStatusBadge(review.status)}
                                                <span className="text-sm text-muted-foreground">
                                                    {new Date(review.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>

                                            {/* Guest Info */}
                                            <div className="text-sm text-muted-foreground">
                                                <span className="font-medium">
                                                    {review.guest?.primaryFirstName} {review.guest?.primaryLastName}
                                                </span>
                                                {review.reservation?.site && (
                                                    <span className="text-muted-foreground"> &middot; {review.reservation.site.name}</span>
                                                )}
                                            </div>

                                            {/* Review Content */}
                                            {review.title && (
                                                <h3 className="font-semibold text-foreground">{review.title}</h3>
                                            )}
                                            {review.body && (
                                                <p className="text-muted-foreground">{review.body}</p>
                                            )}

                                            {/* Votes */}
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <ThumbsUp className="w-4 h-4" /> {review.helpfulCount}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ThumbsDown className="w-4 h-4" /> {review.unhelpfulCount}
                                                </span>
                                            </div>

                                            {/* Owner Reply */}
                                            {review.ownerReply && (
                                                <div className="bg-muted rounded-lg p-4 mt-3">
                                                    <div className="text-xs font-medium text-muted-foreground mb-1">Owner Response</div>
                                                    <p className="text-sm text-foreground">{review.ownerReply}</p>
                                                </div>
                                            )}

                                            {/* Reply Form */}
                                            {replyingTo === review.id && (
                                                <div className="bg-muted rounded-lg p-4 mt-3 space-y-3">
                                                    <Textarea
                                                        placeholder="Write your response..."
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        rows={3}
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => replyMutation.mutate({ reviewId: review.id, body: replyText })}
                                                            disabled={!replyText.trim() || replyMutation.isPending}
                                                        >
                                                            <Send className="w-4 h-4 mr-1" /> Send Reply
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-row md:flex-col gap-2">
                                            {review.status === "pending" && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-emerald-600 hover:bg-emerald-50"
                                                        onClick={() => moderateMutation.mutate({ reviewId: review.id, action: "approve" })}
                                                        disabled={moderateMutation.isPending}
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-rose-600 hover:bg-rose-50"
                                                        onClick={() => moderateMutation.mutate({ reviewId: review.id, action: "reject" })}
                                                        disabled={moderateMutation.isPending}
                                                    >
                                                        <XCircle className="w-4 h-4 mr-1" /> Reject
                                                    </Button>
                                                </>
                                            )}
                                            {review.status === "approved" && !review.ownerReply && replyingTo !== review.id && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setReplyingTo(review.id)}
                                                >
                                                    <MessageSquare className="w-4 h-4 mr-1" /> Reply
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
