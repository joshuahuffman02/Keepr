import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy - Keepr",
    description: "Keepr Privacy Policy - How we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-keepr-off-white">
            <div className="max-w-4xl mx-auto px-6 py-16">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
                    <p className="text-muted-foreground">Last updated: December 2024</p>
                </div>

                {/* Content */}
                <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 prose prose-slate max-w-none">
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">Introduction</h2>
                        <p className="text-muted-foreground">
                            Keepr (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your
                            information when you use our website and services.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">Information We Collect</h2>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Personal Information</h3>
                        <p className="text-muted-foreground mb-4">
                            We may collect personal information that you provide directly to us, including:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2">
                            <li>Name, email address, and phone number</li>
                            <li>Billing and payment information</li>
                            <li>Reservation and booking details</li>
                            <li>Communication preferences</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">Usage Information</h3>
                        <p className="text-muted-foreground">
                            We automatically collect certain information about your device and usage patterns,
                            including IP address, browser type, pages visited, and time spent on our site.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">How We Use Your Information</h2>
                        <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2">
                            <li>Process reservations and payments</li>
                            <li>Send booking confirmations and updates</li>
                            <li>Provide customer support</li>
                            <li>Improve our services and user experience</li>
                            <li>Send promotional communications (with your consent)</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">Information Sharing</h2>
                        <p className="text-muted-foreground">
                            We do not sell your personal information. We may share your information with:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                            <li>Campground owners to fulfill your reservations</li>
                            <li>Payment processors to complete transactions</li>
                            <li>Service providers who assist our operations</li>
                            <li>Legal authorities when required by law</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">Data Security</h2>
                        <p className="text-muted-foreground">
                            We implement appropriate technical and organizational measures to protect your
                            personal information against unauthorized access, alteration, disclosure, or destruction.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">Your Rights</h2>
                        <p className="text-muted-foreground mb-4">You have the right to:</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2">
                            <li>Access your personal information</li>
                            <li>Correct inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Opt out of marketing communications</li>
                            <li>Lodge a complaint with a supervisory authority</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">Cookies</h2>
                        <p className="text-muted-foreground">
                            We use cookies and similar tracking technologies to enhance your experience.
                            You can control cookie settings through your browser preferences.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-foreground mb-4">Contact Us</h2>
                        <p className="text-muted-foreground">
                            If you have questions about this Privacy Policy, please contact us at:
                        </p>
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                            <p className="text-foreground">
                                <strong>Email:</strong> privacy@keeprstay.com<br />
                                <strong>Phone:</strong> (800) 555-CAMP<br />
                                <strong>Address:</strong> 123 Adventure Lane, Boulder, CO 80301
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
