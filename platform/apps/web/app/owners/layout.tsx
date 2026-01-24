import { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export default function OwnersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <MarketingHeader />
      <main>{children}</main>
    </div>
  );
}
