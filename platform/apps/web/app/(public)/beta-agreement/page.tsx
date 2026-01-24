import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Beta Participation Agreement - Keepr",
  description: "Terms for participating in the Keepr early access program.",
};

export default function BetaAgreementPage() {
  return (
    <div className="min-h-screen bg-keepr-off-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-keepr-evergreen/10 text-keepr-evergreen text-sm font-medium rounded-full mb-4">
            Early Access Program
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Beta Participation Agreement
          </h1>
          <p className="text-muted-foreground">Last updated: January 2025</p>
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl shadow-lg p-8 md:p-10 space-y-8">
          {/* Introduction */}
          <section>
            <p className="text-muted-foreground leading-relaxed">
              Thank you for joining the Keepr early access program. By participating, you&apos;re
              helping us build a better campground management platform. This agreement outlines what
              you can expect from us, and what we ask of you as a founding member.
            </p>
          </section>

          {/* What We Provide */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">What We Provide</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen font-bold">1.</span>
                <span>
                  <strong>Early access</strong> to new features before general release
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen font-bold">2.</span>
                <span>
                  <strong>Locked-in pricing</strong> at your current tier for as long as you remain
                  a customer
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen font-bold">3.</span>
                <span>
                  <strong>Direct communication</strong> with our team for support and feedback
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen font-bold">4.</span>
                <span>
                  <strong>Influence</strong> over the product roadmap based on your feedback
                </span>
              </li>
            </ul>
          </section>

          {/* What You Acknowledge */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">What You Acknowledge</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-slate-400 font-bold">1.</span>
                <span>
                  <strong>Beta software:</strong> Keepr is under active development. Features may
                  change, be added, or be removed.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 font-bold">2.</span>
                <span>
                  <strong>No guarantees:</strong> We do not guarantee specific uptime, performance,
                  or feature availability during the beta period.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 font-bold">3.</span>
                <span>
                  <strong>Data backups:</strong> We recommend maintaining independent records for
                  critical business operations.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 font-bold">4.</span>
                <span>
                  <strong>Feedback welcome:</strong> We may contact you for feedback on features,
                  usability, or your experience.
                </span>
              </li>
            </ul>
          </section>

          {/* What We Ask */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">What We Ask of You</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen">•</span>
                <span>
                  <strong>Report bugs:</strong> Let us know when something doesn&apos;t work as
                  expected
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen">•</span>
                <span>
                  <strong>Share feedback:</strong> Tell us what you love, what frustrates you, and
                  what you wish existed
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen">•</span>
                <span>
                  <strong>Be patient:</strong> We&apos;re a small team working hard to build
                  something great
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-keepr-evergreen">•</span>
                <span>
                  <strong>Stay engaged:</strong> Your active use helps us understand real-world
                  needs
                </span>
              </li>
            </ul>
          </section>

          {/* Confidentiality */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">Confidentiality</h2>
            <p className="text-muted-foreground leading-relaxed">
              Some features you see may be unreleased or experimental. We ask that you treat these
              features as confidential and not share screenshots or details publicly without our
              permission. We&apos;re happy to work with you on case studies or testimonials when
              ready.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              Either party may end this beta participation at any time. If you choose to leave,
              we&apos;ll work with you to export your data. Your locked-in pricing remains valid
              only while you maintain continuous active service.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-border pt-8">
            <p className="text-muted-foreground text-sm">
              Questions about this agreement? Contact us at{" "}
              <a
                href="mailto:founders@keeprstay.com"
                className="text-keepr-evergreen hover:underline"
              >
                founders@keeprstay.com
              </a>
            </p>
          </section>
        </div>

        {/* Links */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            This agreement supplements our{" "}
            <Link href="/terms" className="text-keepr-evergreen hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-keepr-evergreen hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-keepr-evergreen text-white font-semibold rounded-lg hover:bg-keepr-evergreen/90 transition-colors"
          >
            Join Early Access
          </Link>
        </div>
      </div>
    </div>
  );
}
