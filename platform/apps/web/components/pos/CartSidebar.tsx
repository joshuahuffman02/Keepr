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
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">Current Order</h2>
                    {itemCount > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                            {itemCount}
                        </span>
                    )}
                </div>
                {cart.length > 0 && (
                    <button
                        onClick={onClear}
                        className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
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
                        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full mb-4">
                            <ShoppingCart className="h-10 w-10 text-emerald-500" />
                        </div>
                        <h3 className="font-medium text-slate-700 mb-1">Ready for orders!</h3>
                        <p className="text-sm text-slate-500 max-w-[200px]">
                            Tap products to add them here. Fast checkout awaits!
                        </p>
                        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Tip: Use keyboard shortcuts for speed</span>
                        </div>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border transition-all duration-300",
                                item.justAdded
                                    ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-500/20 motion-safe:animate-in motion-safe:slide-in-from-right-2"
                                    : "border-slate-100"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">{item.name}</div>
                                <div className="text-sm text-slate-500">
                                    ${(item.priceCents / 100).toFixed(2)} × {item.qty} =
                                    <span className="font-medium text-slate-700 ml-1">
                                        ${((item.priceCents * item.qty) / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            {/* Larger touch targets (44x44px minimum) */}
                            <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                                <button
                                    onClick={() => onUpdateQty(item.id, -1)}
                                    className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors active:scale-95"
                                    aria-label={`Decrease ${item.name} quantity`}
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-8 text-center font-bold text-sm tabular-nums">{item.qty}</span>
                                <button
                                    onClick={() => onUpdateQty(item.id, 1)}
                                    className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors active:scale-95"
                                    aria-label={`Increase ${item.name} quantity`}
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span>${(totalCents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-600">
                        <span>Tax (0%)</span>
                        <span>$0.00</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
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
