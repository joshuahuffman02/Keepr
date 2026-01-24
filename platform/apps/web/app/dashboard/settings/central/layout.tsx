"use client";

import { ReactNode } from "react";
import { SettingsProvider, SettingsShell } from "@/components/settings";

interface CentralSettingsLayoutProps {
  children: ReactNode;
}

export default function CentralSettingsLayout({ children }: CentralSettingsLayoutProps) {
  return (
    <SettingsProvider>
      <SettingsShell>{children}</SettingsShell>
    </SettingsProvider>
  );
}
