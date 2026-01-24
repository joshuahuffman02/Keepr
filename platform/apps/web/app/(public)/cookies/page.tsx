import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy - Keepr",
  description: "Learn how Keepr uses cookies and similar technologies to improve your experience.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-keepr-off-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Cookie Policy</h1>
          <p className="text-muted-foreground">Last updated: December 2024</p>
        </div>

        <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 prose prose-slate max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">What are cookies?</h2>
            <p className="text-muted-foreground">
              Cookies are small text files stored on your device that help websites remember your
              preferences, keep you signed in, and understand how people use the site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">How we use cookies</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Keep the site secure and maintain session state</li>
              <li>Remember your preferences and recent searches</li>
              <li>Measure site performance and improve the experience</li>
              <li>Understand which content is most helpful to campers</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Types of cookies we use</h2>
            <p className="text-muted-foreground">
              We use essential cookies for site functionality, analytics cookies to understand usage
              patterns, and functional cookies to personalize your experience.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Your choices</h2>
            <p className="text-muted-foreground">
              You can control cookies through your browser settings. Disabling certain cookies may
              affect site functionality, such as saved searches or login sessions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Contact us</h2>
            <p className="text-muted-foreground">
              Questions about our cookie policy? Email us at{" "}
              <a href="mailto:privacy@keeprstay.com">privacy@keeprstay.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
