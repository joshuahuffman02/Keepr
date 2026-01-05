import { ReactNode } from "react";
import { PublicHeader } from "../../components/public/PublicHeader";
import { PublicFooter } from "../../components/public/PublicFooter";
import { ScrollProgressIndicator } from "../../components/ui/scroll-progress-indicator";

export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <PublicHeader />
            <main id="main-content" className="pt-20">
                {children}
            </main>

            {/* Personality features */}
            <ScrollProgressIndicator />

            {/* Footer */}
            <PublicFooter />
        </div>
    );
}
