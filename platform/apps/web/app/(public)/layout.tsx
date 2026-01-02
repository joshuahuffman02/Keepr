import { ReactNode } from "react";
import { PublicHeader } from "../../components/public/PublicHeader";
import { ScrollProgressIndicator } from "../../components/ui/scroll-progress-indicator";
import { WelcomeOverlay } from "../../components/public/WelcomeOverlay";

export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <PublicHeader />
            <main className="pt-20">
                {children}
            </main>

            {/* Personality features */}
            <ScrollProgressIndicator />
            <WelcomeOverlay />

            {/* Footer */}
            <footer className="bg-slate-900 text-white mt-20">
                <div className="max-w-7xl mx-auto px-6 py-16">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        {/* Brand */}
                        <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m4 20 8-14 8 14" />
                                        <path d="M2 20h20" />
                                    </svg>
                                </div>
                                <span className="text-xl font-bold">Camp Everyday</span>
                            </div>
                            <p className="text-slate-400 text-sm">
                                Discover and book the perfect campground for your next adventure.
                            </p>
                        </div>

                        {/* Links */}
                        <div>
                            <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">Explore</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">Find Campgrounds</a></li>
                                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">Top Destinations</a></li>
                                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">RV Parks</a></li>
                                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">Cabins</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">For Owners</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/auth/signin?callbackUrl=/dashboard" className="text-slate-300 hover:text-white transition-colors">Owner Login</a></li>
                                <li><a href="/owners" className="text-slate-300 hover:text-white transition-colors">List Your Property</a></li>
                                <li><a href="/owners" className="text-slate-300 hover:text-white transition-colors">Management Tools</a></li>
                                <li><a href="/owners#pricing" className="text-slate-300 hover:text-white transition-colors">Pricing</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">Support</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/help" className="text-slate-300 hover:text-white transition-colors">Help Center</a></li>
                                <li><a href="/contact" className="text-slate-300 hover:text-white transition-colors">Contact Us</a></li>
                                <li><a href="/terms" className="text-slate-300 hover:text-white transition-colors">Terms of Service</a></li>
                                <li><a href="/privacy" className="text-slate-300 hover:text-white transition-colors">Privacy Policy</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-800 flex items-center justify-center">
                        <p className="text-sm text-slate-500">
                            © {new Date().getFullYear()} Camp Everyday. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
