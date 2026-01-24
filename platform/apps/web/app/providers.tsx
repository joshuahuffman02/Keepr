"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { SessionProvider } from "next-auth/react";
import { PropsWithChildren, useState } from "react";

const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
  { ssr: false },
);
import { KeyboardShortcutsProvider } from "@/contexts/KeyboardShortcutsContext";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts-dialog";
import { KeyboardSequenceIndicator } from "@/components/ui/keyboard-sequence-indicator";
import { GlobalCommandPalette } from "@/components/ui/global-command-palette";
import { AccessibilityProvider } from "@/components/accessibility/AccessibilityProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { CampgroundProvider } from "@/contexts/CampgroundContext";

export function Providers({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <SessionProvider>
        <QueryClientProvider client={client}>
          <CampgroundProvider>
            <AccessibilityProvider>
              <KeyboardShortcutsProvider>
                {children}
                <GlobalCommandPalette />
                <KeyboardShortcutsDialog />
                <KeyboardSequenceIndicator />
                {process.env.NODE_ENV === "development" ? (
                  <ReactQueryDevtools initialIsOpen={false} />
                ) : null}
              </KeyboardShortcutsProvider>
            </AccessibilityProvider>
          </CampgroundProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
