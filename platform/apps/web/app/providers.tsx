"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SessionProvider } from "next-auth/react";
import { PropsWithChildren, useState } from "react";
import { KeyboardShortcutsProvider } from "@/contexts/KeyboardShortcutsContext";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts-dialog";
import { KeyboardSequenceIndicator } from "@/components/ui/keyboard-sequence-indicator";

export function Providers({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        <KeyboardShortcutsProvider>
          {children}
          <KeyboardShortcutsDialog />
          <KeyboardSequenceIndicator />
          <ReactQueryDevtools initialIsOpen={false} />
        </KeyboardShortcutsProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

