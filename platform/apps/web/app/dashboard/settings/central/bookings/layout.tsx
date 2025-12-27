"use client";

import { ReactNode } from "react";
import { SectionTabs } from "@/components/settings/navigation";
import { getSectionsForCategory } from "@/components/settings/sections";

const sections = getSectionsForCategory("bookings");

interface BookingsLayoutProps {
  children: ReactNode;
}

export default function BookingsLayout({ children }: BookingsLayoutProps) {
  return (
    <div>
      <SectionTabs sections={sections} categoryId="bookings" />
      <div className="p-6">{children}</div>
    </div>
  );
}
