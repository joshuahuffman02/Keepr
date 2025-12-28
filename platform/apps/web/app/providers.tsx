"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SessionProvider } from "next-auth/react";
import { PropsWithChildren, useState } from "react";
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
                <ReactQueryDevtools initialIsOpen={false} />
              </KeyboardShortcutsProvider>
            </AccessibilityProvider>
          </CampgroundProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

