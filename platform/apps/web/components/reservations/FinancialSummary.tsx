import { useState } from "react";
import { Reservation } from "@campreserv/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard } from "lucide-react";
import { PaymentModal } from "../payments/PaymentModal";

interface FinancialSummaryProps {
    reservation: Reservation;
}

export function FinancialSummary({ reservation }: FinancialSummaryProps) {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(cents / 100);
    };

    const balanceCents = reservation.balanceAmount ?? 0;
    const totalCents = reservation.totalAmount ?? 0;
    const paidCents = reservation.paidAmount ?? 0;
    const baseCents = reservation.baseSubtotal ?? 0;
    const taxCents = reservation.taxesAmount ?? 0;
    const feesCents = reservation.feesAmount ?? 0;
    const discountsCents = reservation.discountsAmount ?? 0;
    const feeMode = (reservation as any)?.feeMode ?? (reservation as any)?.metadata?.feeMode ?? null;

    const isPaid = balanceCents <= 0;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <DollarSign className="w-5 h-5 text-slate-500" />
                        Financial Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">Total Amount</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(totalCents)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">Paid to Date</span>
                            <span className="font-medium text-emerald-600">{formatCurrency(paidCents)}</span>
                        </div>
                        <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                            <span className="font-medium text-slate-900">Balance Due</span>
                            <span className={`text-lg font-bold ${isPaid ? "text-slate-400" : "text-red-600"}`}>
                                {formatCurrency(balanceCents)}
                            </span>
                        </div>
                        {!isPaid && (
                            <Button
                                className="w-full mt-2"
                                onClick={() => setIsPaymentModalOpen(true)}
                            >
                                <CreditCard className="w-4 h-4 mr-2" />
                                Pay Balance
                            </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>Base Rate</span>
                            <span>{formatCurrency(baseCents)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>Taxes</span>
                            <span>{formatCurrency(taxCents)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>Fees</span>
                            <span>{formatCurrency(feesCents)}</span>
                        </div>
                        <div className="text-xs text-slate-500 leading-relaxed" aria-live="polite">
                            {feeMode === "pass_through"
                                ? "Guest paid service fees on this booking."
                                : feeMode === "absorb"
                                    ? "Service fees were absorbed by the property."
                                    : "Fees are itemized separately from taxes for clarity."}
                        </div>
                        {discountsCents > 0 && (
                            <div className="flex justify-between text-sm text-emerald-600">
                                <span>Discounts</span>
                                <span>-{formatCurrency(discountsCents)}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                reservationId={reservation.id}
                amountCents={balanceCents}
                onSuccess={() => {
                    // In a real app, we'd trigger a revalidation or toast here
                    window.location.reload();
                }}
            />
        </>
    );
}
