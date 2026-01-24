import { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, MessageCircle, ShieldCheck, CalendarClock } from "lucide-react";

export const metadata: Metadata = {
  title: "Help Center | Keepr",
  description: "Get answers about booking, pricing, cancellations, and support.",
};

const quickLinks = [
  {
    title: "Booking & payments",
    description: "How reservations, fees, and refunds work.",
    href: "/help#faq",
    icon: CalendarClock,
  },
  {
    title: "Cancellation policy",
    description: "Understand timing, refunds, and campground-specific rules.",
    href: "/help#cancellation",
    icon: ShieldCheck,
  },
  {
    title: "Contact support",
    description: "Reach our team for personalized help.",
    href: "/contact",
    icon: MessageCircle,
  },
];

const faqItems = [
  {
    question: "How do I find available campgrounds?",
    answer:
      "Use the search bar on the homepage or browse by state on the camping page. Filter by amenities, dates, and stay type to narrow results.",
  },
  {
    question: "Are prices all-inclusive?",
    answer:
      "We show transparent pricing and itemize fees whenever they apply. Campground-specific taxes and fees are surfaced before booking.",
  },
  {
    question: "Can I change or cancel a booking?",
    answer:
      "Yes. Each campground has its own cancellation policy. Review the policy before booking and reach out if you need help making changes.",
  },
  {
    question: "Do you offer support for campground owners?",
    answer:
      "Absolutely. Owners can reach our team for setup, migration, and day-to-day operational questions.",
  },
];

export default function PublicHelpPage() {
  return (
    <div className="min-h-screen">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-keepr-evergreen/10 px-4 py-2 text-sm font-semibold text-keepr-evergreen">
            <LifeBuoy className="h-4 w-4" />
            Help Center
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Get the answers you need
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Quick guidance for booking, pricing, cancellations, and support. If you need a hand, our
            team is ready to help.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-keepr-evergreen/10 text-keepr-evergreen">
                <item.icon className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-keepr-evergreen">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>

        <section id="faq" className="mt-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">FAQs</h2>
          <div className="space-y-4">
            {faqItems.map((item) => (
              <div key={item.question} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">{item.question}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="cancellation" className="mt-16">
          <div className="rounded-2xl border border-keepr-evergreen/20 bg-keepr-evergreen/10 p-8">
            <h2 className="text-2xl font-bold text-foreground mb-3">Cancellation policy</h2>
            <p className="text-sm text-muted-foreground">
              Policies vary by campground. We recommend reviewing the policy on each listing before
              you book. If you need help making a change, our support team can guide you through the
              options.
            </p>
            <div className="mt-6">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg bg-keepr-evergreen px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-keepr-evergreen-light"
              >
                Contact support
              </Link>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
