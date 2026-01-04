import { Metadata } from "next";
import { Suspense } from "react";
import { HomeClient } from "./client";

export const metadata: Metadata = {
    title: "Keepr - Find your perfect camping adventure",
    description: "Search and book campgrounds, RV parks, and cabins. Start your outdoor adventure today.",
};

// Loading fallback for HomeClient while useSearchParams resolves
function HomeLoading() {
    return (
        <div className="min-h-screen bg-slate-50 animate-pulse">
            <div className="h-[500px] bg-gradient-to-b from-emerald-50 to-white" />
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="h-12 bg-slate-200 rounded-lg w-full max-w-2xl mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                            <div className="aspect-[4/3] bg-slate-200" />
                            <div className="p-5 space-y-3">
                                <div className="h-4 bg-slate-200 rounded w-1/3" />
                                <div className="h-5 bg-slate-200 rounded w-2/3" />
                                <div className="h-4 bg-slate-200 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<HomeLoading />}>
            <HomeClient />
        </Suspense>
    );
}
