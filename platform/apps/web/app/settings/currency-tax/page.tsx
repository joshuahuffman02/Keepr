"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * This page has been consolidated into /settings/tax-rules
 * Redirecting users to the new unified Tax & Currency settings page.
 */
export default function CurrencyTaxPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/tax-rules");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center text-slate-500">
        <p>Redirecting to Tax & Currency settings...</p>
      </div>
    </div>
  );
}
