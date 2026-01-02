"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, ExternalLink } from "lucide-react";

export default function DepositsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Deposits</h2>
        <p className="text-muted-foreground mt-1">
          Configure deposit requirements and payment schedules
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-emerald-100">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Deposit Policies</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Set deposit amounts, due dates, and automatic payment collection rules.
                Configure different policies for different booking types.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/deposit-policies">
                    Open Deposit Settings
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
