import { Metadata } from "next";
import { DemoClient } from "./client";

export const metadata: Metadata = {
  title: "Live Demo | Keepr - Try Campground Software Free",
  description:
    "Explore Keepr with real data. See reservations, POS, staff scheduling, AI features, and more. No signup required to browse. Full access with email.",
  keywords: [
    "campground software demo",
    "rv park software demo",
    "camp everyday demo",
    "campground management demo",
  ],
  openGraph: {
    title: "Try Keepr - Live Demo with Real Data",
    description:
      "Explore our campground management software with a fully-loaded demo environment. See why parks are switching.",
    type: "website",
  },
};

export default function DemoPage() {
  return <DemoClient />;
}
