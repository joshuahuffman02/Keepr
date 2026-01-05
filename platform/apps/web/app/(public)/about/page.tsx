import { Metadata } from "next";

export const metadata: Metadata = {
    title: "About Us - Keepr",
    description: "Learn about Keepr - the platform connecting outdoor enthusiasts with amazing campgrounds.",
};

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-keepr-off-white">
            <div className="max-w-4xl mx-auto px-6 py-16">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                        About Keepr
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        We're on a mission to make camping accessible and enjoyable for everyone.
                    </p>
                </div>

                {/* Story Section */}
                <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6">Our Story</h2>
                    <div className="prose prose-slate max-w-none">
                        <p className="text-muted-foreground mb-4">
                            Keepr was founded with a simple belief: that the great outdoors should be
                            accessible to everyone. We&apos;ve built a platform that connects campers with amazing
                            campgrounds while giving campground owners the tools they need to succeed.
                        </p>
                        <p className="text-muted-foreground mb-4">
                            Whether you&apos;re a first-time camper looking for the perfect spot or a seasoned RVer
                            planning your next adventure, Keepr makes it easy to find, book, and enjoy
                            your outdoor experience.
                        </p>
                        <p className="text-muted-foreground">
                            For campground owners, our Host platform streamlines operations, maximizes revenue,
                            and helps deliver exceptional guest experiences.
                        </p>
                    </div>
                </div>

                {/* Values */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-card rounded-xl p-6 shadow-lg">
                        <div className="w-12 h-12 bg-keepr-evergreen/10 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-keepr-evergreen" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-foreground mb-2">Adventure First</h3>
                        <p className="text-sm text-muted-foreground">
                            We believe every camping trip should be an adventure worth remembering.
                        </p>
                    </div>
                    <div className="bg-card rounded-xl p-6 shadow-lg">
                        <div className="w-12 h-12 bg-keepr-charcoal/10 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-keepr-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-foreground mb-2">Community</h3>
                        <p className="text-sm text-muted-foreground">
                            Building connections between campers and campground owners.
                        </p>
                    </div>
                    <div className="bg-card rounded-xl p-6 shadow-lg">
                        <div className="w-12 h-12 bg-keepr-clay/10 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-keepr-clay" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-foreground mb-2">Sustainability</h3>
                        <p className="text-sm text-muted-foreground">
                            Committed to preserving the outdoors for future generations.
                        </p>
                    </div>
                </div>

                {/* CTA */}
                <div className="text-center bg-gradient-to-r from-keepr-evergreen to-keepr-clay rounded-2xl p-8 text-white">
                    <h2 className="text-2xl font-bold mb-4">Ready to Start Your Adventure?</h2>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="/"
                            className="px-6 py-3 bg-white text-keepr-evergreen font-semibold rounded-lg hover:bg-keepr-off-white transition-colors"
                        >
                            Find Campgrounds
                        </a>
                        <a
                            href="/owners"
                            className="px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
                        >
                            For Campground Owners
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
