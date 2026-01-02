"use client";

import { Campground, DepositConfig } from "@campreserv/shared";
import { DepositSettingsForm } from "../settings/DepositSettingsForm";

interface DepositSettingsProps {
    campground: Campground & { depositConfig?: DepositConfig | null };
}

export function DepositSettings({ campground }: DepositSettingsProps) {
    return (
        <div className="card p-6 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-foreground">Deposit Rules</h3>
                <p className="text-sm text-muted-foreground">Configure how deposits are calculated for reservations.</p>
            </div>

            <DepositSettingsForm
                campgroundId={campground.id}
                initialRule={campground.depositRule || "none"}
                initialPercentage={campground.depositPercentage || null}
                initialConfig={campground.depositConfig || null}
            />
        </div>
    );
}
