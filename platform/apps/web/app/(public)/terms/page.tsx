import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Keepr",
  description: "Keepr Terms of Service - Rules and guidelines for using our platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-keepr-off-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: January 2025</p>
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 prose prose-slate max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Keepr&apos;s website and services, you agree to be bound by
              these Terms of Service. If you do not agree to these terms, please do not use our
              services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Services Description</h2>
            <p className="text-muted-foreground">
              Keepr provides an online platform that connects travelers with campground owners. We
              facilitate reservations but are not responsible for the campgrounds themselves or the
              services they provide.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Early Access Program</h2>
            <p className="text-muted-foreground mb-4">
              Keepr is currently in early access (&quot;Beta&quot;). By using our services, you
              acknowledge:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>
                <strong>Active Development:</strong> Features may be added, modified, or removed as
                we improve the platform
              </li>
              <li>
                <strong>Service Availability:</strong> We do not guarantee specific uptime or
                performance levels during this period
              </li>
              <li>
                <strong>Data Accuracy:</strong> While we strive for accuracy, booking data and
                calculations should be verified independently
              </li>
              <li>
                <strong>Backups:</strong> We recommend maintaining independent records for critical
                business operations
              </li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We&apos;re building Keepr alongside our founding users. Your feedback directly shapes
              the product.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">User Accounts</h2>
            <p className="text-muted-foreground mb-4">When creating an account, you agree to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Be responsible for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Reservations and Payments</h2>
            <h3 className="text-lg font-semibold text-foreground mb-2">Booking Process</h3>
            <p className="text-muted-foreground mb-4">
              All reservations are subject to availability and acceptance by the campground owner. A
              reservation is not confirmed until you receive a confirmation email.
            </p>

            <h3 className="text-lg font-semibold text-foreground mb-2">Cancellation Policy</h3>
            <p className="text-muted-foreground">
              Cancellation policies vary by campground. Please review the specific cancellation
              policy for each reservation before booking. Refunds will be processed according to the
              applicable policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">User Conduct</h2>
            <p className="text-muted-foreground mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Submit false or misleading information</li>
              <li>Attempt to access unauthorized areas of our platform</li>
              <li>Use our services for any illegal purposes</li>
              <li>Harass or harm other users or campground staff</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Intellectual Property</h2>
            <p className="text-muted-foreground">
              All content on Keepr, including text, graphics, logos, and software, is the property
              of Keepr or its licensors and is protected by intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              Keepr is not liable for any indirect, incidental, special, or consequential damages
              arising from your use of our services. Our total liability shall not exceed the amount
              you paid for the specific service giving rise to the claim.
            </p>
            <p className="text-muted-foreground mb-4">
              During the early access period, Keepr and its affiliates shall not be liable for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Lost reservations, revenue, or business opportunities</li>
              <li>Interruption to your campground operations</li>
              <li>Inaccuracies in reports, calculations, or guest data</li>
              <li>Any indirect, incidental, or consequential damages</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Your use of Keepr during early access is at your own discretion. Maximum liability is
              limited to fees paid in the 12 months preceding any claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Disclaimers</h2>
            <p className="text-muted-foreground">
              Our services are provided &quot;as is&quot; without warranties of any kind. We do not
              guarantee the accuracy of campground listings or the quality of accommodations. You
              use our services at your own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms of Service from time to time. We will notify you of
              significant changes by email or through our website. Your continued use of our
              services after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-foreground">
                <strong>Email:</strong> legal@keeprstay.com
                <br />
                <strong>Phone:</strong> (800) 555-CAMP
                <br />
                <strong>Address:</strong> 123 Adventure Lane, Boulder, CO 80301
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
