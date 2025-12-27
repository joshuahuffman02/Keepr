"use client";

import { ReactNode } from "react";
import { SectionTabs } from "@/components/settings/navigation";
import { getSectionsForCategory } from "@/components/settings/sections";

const sections = getSectionsForCategory("access");

interface AccessLayoutProps {
  children: ReactNode;
}

export default function AccessLayout({ children }: AccessLayoutProps) {
  return (
    <div>
      <SectionTabs sections={sections} categoryId="access" />
      <div className="p-6">{children}</div>
    </div>
  );
}
