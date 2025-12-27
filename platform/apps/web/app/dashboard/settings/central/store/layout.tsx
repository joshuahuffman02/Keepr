"use client";

import { ReactNode } from "react";
import { SectionTabs } from "@/components/settings/navigation";
import { getSectionsForCategory } from "@/components/settings/sections";

const sections = getSectionsForCategory("store");

interface StoreLayoutProps {
  children: ReactNode;
}

export default function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <div>
      <SectionTabs sections={sections} categoryId="store" />
      <div className="p-6">{children}</div>
    </div>
  );
}
