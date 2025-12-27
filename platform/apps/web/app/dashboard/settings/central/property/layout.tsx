"use client";

import { ReactNode } from "react";
import { SectionTabs } from "@/components/settings/navigation";
import { getSectionsForCategory } from "@/components/settings/sections";

const sections = getSectionsForCategory("property");

interface PropertyLayoutProps {
  children: ReactNode;
}

export default function PropertyLayout({ children }: PropertyLayoutProps) {
  return (
    <div>
      <SectionTabs sections={sections} categoryId="property" />
      <div className="p-6">{children}</div>
    </div>
  );
}
