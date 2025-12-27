"use client";

import { ReactNode } from "react";
import { SectionTabs } from "@/components/settings/navigation";
import { getSectionsForCategory } from "@/components/settings/sections";

const sections = getSectionsForCategory("system");

interface SystemLayoutProps {
  children: ReactNode;
}

export default function SystemLayout({ children }: SystemLayoutProps) {
  return (
    <div>
      <SectionTabs sections={sections} categoryId="system" />
      <div className="p-6">{children}</div>
    </div>
  );
}
