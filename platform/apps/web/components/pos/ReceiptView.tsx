"use client";

import { Button } from "../ui/button";

interface ReceiptViewProps {
    order: any;
    onNewOrder: () => void;
}

export function ReceiptView({ order, onNewOrder }: ReceiptViewProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            <div className="w-16 h-16 bg-status-success/15 text-status-success rounded-full flex items-center justify-center mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">Order Complete!</h1>
            <p className="text-muted-foreground mb-8">Order #{order.id.slice(0, 8)}</p>

            <div className="w-full bg-card border border-border rounded-xl p-6 shadow-sm mb-8 space-y-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-status-success uppercase">{order.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="font-medium capitalize">{order.paymentMethod || "Card"}</span>
                </div>
                <div className="border-t border-border pt-4 flex justify-between items-center">
                    <span className="font-semibold text-foreground">Total Paid</span>
                    <span className="text-xl font-bold text-foreground">${(order.totalCents / 100).toFixed(2)}</span>
                </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
                <Button size="lg" className="w-full" onClick={onNewOrder}>
                    Start New Order
                </Button>
                <Button variant="outline" size="lg" className="w-full">
                    Print Receipt
                </Button>
            </div>
        </div>
    );
}
