"use client";

import { ReactNode } from "react";
import { SectionTabs } from "@/components/settings/navigation";
import { getSectionsForCategory } from "@/components/settings/sections";

const sections = getSectionsForCategory("pricing");

interface PricingLayoutProps {
  children: ReactNode;
}

export default function PricingLayout({ children }: PricingLayoutProps) {
  return (
    <div>
      <SectionTabs sections={sections} categoryId="pricing" />
      <div className="p-6">{children}</div>
    </div>
  );
}
