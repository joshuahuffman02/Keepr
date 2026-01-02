"use client";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ShoppingCart, Minus, Plus, Sparkles } from "lucide-react";

type CartItem = {
    id: string;
    name: string;
    priceCents: number;
    qty: number;
    justAdded?: boolean;
};

interface CartSidebarProps {
    cart: CartItem[];
    onUpdateQty: (id: string, delta: number) => void;
    onClear: () => void;
    onCheckout: () => void;
}

export function CartSidebar({ cart, onUpdateQty, onClear, onCheckout }: CartSidebarProps) {
    const totalCents = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/50">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-foreground">Current Order</h2>
                    {itemCount > 0 && (
                        <span className="px-2 py-0.5 bg-status-success-bg text-status-success-text text-xs font-bold rounded-full">
                            {itemCount}
                        </span>
                    )}
                </div>
                {cart.length > 0 && (
                    <button
                        onClick={onClear}
                        className="text-xs text-status-error hover:text-status-error font-medium px-2 py-1 rounded hover:bg-status-error/10 transition-colors"
                        aria-label="Clear all items from cart"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Live region for screen reader announcements */}
            <div role="status" aria-live="polite" className="sr-only">
                {itemCount > 0 ? `${itemCount} items in cart, total $${(totalCents / 100).toFixed(2)}` : "Cart is empty"}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="p-4 bg-status-success-bg rounded-full mb-4">
                            <ShoppingCart className="h-10 w-10 text-action-primary" />
                        </div>
                        <h3 className="font-medium text-foreground mb-1">Ready for orders!</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">
                            Tap products to add them here. Fast checkout awaits!
                        </p>
                        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Tip: Use keyboard shortcuts for speed</span>
                        </div>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "flex items-center justify-between gap-3 bg-muted p-3 rounded-lg border transition-all duration-300",
                                item.justAdded
                                    ? "border-status-success-border bg-status-success-bg ring-2 ring-status-success/20 motion-safe:animate-in motion-safe:slide-in-from-right-2"
                                    : "border-border"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground truncate">{item.name}</div>
                                <div className="text-sm text-muted-foreground">
                                    ${(item.priceCents / 100).toFixed(2)} × {item.qty} =
                                    <span className="font-medium text-foreground ml-1">
                                        ${((item.priceCents * item.qty) / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            {/* Larger touch targets (44x44px minimum) */}
                            <div className="flex items-center gap-1 bg-card rounded-lg border border-border p-1 shadow-sm">
                                <button
                                    onClick={() => onUpdateQty(item.id, -1)}
                                    className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors active:scale-95"
                                    aria-label={`Decrease ${item.name} quantity`}
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-8 text-center font-bold text-sm tabular-nums">{item.qty}</span>
                                <button
                                    onClick={() => onUpdateQty(item.id, 1)}
                                    className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors active:scale-95"
                                    aria-label={`Increase ${item.name} quantity`}
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-muted border-t border-border space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>${(totalCents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tax (0%)</span>
                        <span>$0.00</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border">
                        <span>Total</span>
                        <span>${(totalCents / 100).toFixed(2)}</span>
                    </div>
                </div>

                <Button
                    className="w-full h-12 text-lg"
                    size="lg"
                    disabled={cart.length === 0}
                    onClick={onCheckout}
                >
                    Checkout ${(totalCents / 100).toFixed(2)}
                </Button>
            </div>
        </div>
    );
}
