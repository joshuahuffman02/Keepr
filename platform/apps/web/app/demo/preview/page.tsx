import { Metadata } from "next";
import Link from "next/link";
import {
  Calendar,
  Users,
  CreditCard,
  BarChart3,
  ShoppingCart,
  Clock,
  ArrowRight,
  Play,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public/PublicHeader";

export const metadata: Metadata = {
  title: "Demo Preview | Keepr - Explore Without Signing Up",
  description:
    "Browse Keepr features without creating an account. See the dashboard, calendar, and key features in action.",
};

const previewScreens = [
  {
    title: "Reservation Calendar",
    description: "Drag-and-drop calendar with real-time availability",
    icon: Calendar,
    image: "/images/demo/calendar-preview.png",
  },
  {
    title: "Guest Management",
    description: "Complete guest profiles with communication history",
    icon: Users,
    image: "/images/demo/guests-preview.png",
  },
  {
    title: "Payment Processing",
    description: "Integrated payments with automatic reconciliation",
    icon: CreditCard,
    image: "/images/demo/payments-preview.png",
  },
  {
    title: "Analytics Dashboard",
    description: "AI-powered insights and demand forecasting",
    icon: BarChart3,
    image: "/images/demo/analytics-preview.png",
  },
  {
    title: "Point of Sale",
    description: "Camp store with inventory management",
    icon: ShoppingCart,
    image: "/images/demo/pos-preview.png",
  },
  {
    title: "Staff Scheduling",
    description: "Sync schedules with occupancy automatically",
    icon: Clock,
    image: "/images/demo/scheduling-preview.png",
  },
];

export default function DemoPreviewPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-full text-slate-300 text-sm font-semibold mb-8">
            <Play className="h-4 w-4" />
            Preview Mode
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Explore Keepr
          </h1>

          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Browse key features and screens without signing up.
            Ready for hands-on access? Get full demo credentials in seconds.
          </p>

          <Button
            asChild
            size="lg"
            className="px-8 py-6 text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
          >
            <Link href="/demo">
              Get Full Demo Access
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Preview Screens */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Feature Previews
            </h2>
            <p className="text-lg text-slate-600">
              Click any screen to see it in detail
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {previewScreens.map((screen) => (
              <div
                key={screen.title}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-violet-300 transition-all cursor-pointer"
              >
                {/* Preview Image Placeholder */}
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <screen.icon className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                      <span className="text-sm text-slate-500">Preview</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/10 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white rounded-full p-3 shadow-lg">
                        <Play className="h-6 w-6 text-violet-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-violet-600 transition-colors">
                    {screen.title}
                  </h3>
                  <p className="text-slate-600 text-sm">{screen.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upgrade CTA */}
      <section className="py-16 bg-violet-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 text-white mb-4">
            <Lock className="h-6 w-6" />
            <span className="text-lg font-semibold">Want hands-on access?</span>
          </div>
          <p className="text-violet-100 mb-8 max-w-2xl mx-auto">
            Get full demo credentials to create reservations, modify rates,
            and explore every feature. Takes 30 seconds.
          </p>
          <Button
            asChild
            size="lg"
            className="px-8 py-6 text-lg bg-white text-violet-600 hover:bg-violet-50"
          >
            <Link href="/demo">
              Get Demo Credentials
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-slate-400 text-sm">
              Keepr - Preview without commitment.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/pricing" className="hover:text-white">
                Pricing
              </Link>
              <Link href="/demo" className="hover:text-white">
                Full Demo
              </Link>
              <Link href="/signup" className="hover:text-white">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
