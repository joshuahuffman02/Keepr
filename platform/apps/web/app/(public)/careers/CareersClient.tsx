"use client";

import Link from "next/link";
import { Briefcase, Users, HeartHandshake, Laptop } from "lucide-react";

const roles = [
  { title: "Founding Engineer (Full-stack)", location: "Remote (US)", type: "Full-time" },
  { title: "Product Designer", location: "Remote (US)", type: "Full-time" },
  { title: "Customer Success Lead", location: "Remote (US)", type: "Full-time" },
];

export default function CareersClient() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-keepr-evergreen/10 text-keepr-evergreen text-xs font-semibold border border-keepr-evergreen/20">
          We're hiring soon
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Careers at Keepr</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Help campgrounds run smoother and delight guests. Join us as we build the operating system
          for outdoor hospitality.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: Briefcase,
            label: "Impactful work",
            desc: "Own major pieces of product and platform.",
          },
          {
            icon: Users,
            label: "Customer-first",
            desc: "Build alongside campground teams and guests.",
          },
          {
            icon: HeartHandshake,
            label: "Supportive culture",
            desc: "Kind, pragmatic, remote-friendly.",
          },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <item.icon className="h-5 w-5 text-keepr-evergreen mb-2" />
            <div className="font-semibold text-foreground">{item.label}</div>
            <div className="text-sm text-muted-foreground">{item.desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-bold text-foreground">Open roles (early hiring plan)</h2>
        <p className="text-muted-foreground text-sm">
          We're pre-launch and gathering interest. Tell us about you—roles will open as we scale.
        </p>
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.title}
              className="flex items-center justify-between bg-muted border border-border rounded-lg px-4 py-3"
            >
              <div>
                <div className="font-semibold text-foreground">{role.title}</div>
                <div className="text-xs text-muted-foreground">
                  {role.location} • {role.type}
                </div>
              </div>
              <span className="text-xs font-semibold text-keepr-evergreen bg-keepr-evergreen/10 px-2 py-1 rounded-full">
                Pipeline
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="mailto:careers@keeprstay.com"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-keepr-evergreen rounded-lg hover:bg-keepr-evergreen-dark"
          >
            Send your resume
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-keepr-evergreen bg-keepr-evergreen/10 rounded-lg border border-keepr-evergreen/20 hover:bg-keepr-evergreen/15"
          >
            Share your story
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          We welcome generalists and outdoors lovers—even if you don't see the perfect title here.
        </p>
      </div>

      <div className="bg-keepr-charcoal text-white rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-keepr-clay-light">How we work</div>
          <div className="text-xl font-bold">Remote-first, camper-first</div>
          <div className="text-sm text-white/70">
            Product-led, customer obsessed, and shipping fast with tight feedback loops.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-keepr-evergreen/15 border border-keepr-evergreen/40 flex items-center justify-center">
            <Laptop className="h-6 w-6 text-keepr-clay-light" />
          </div>
          <div className="text-sm text-white/70">
            Tools: Next.js, React, TypeScript, Postgres, Prisma, Tailwind
          </div>
        </div>
      </div>
    </div>
  );
}
