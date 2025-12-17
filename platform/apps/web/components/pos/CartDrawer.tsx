"use client";

import { Sheet, SheetContent, SheetOverlay, SheetPortal } from "../ui/sheet";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type CartItem = {
    id: string;
    name: string;
    priceCents: number;
    qty: number;
};

interface CartDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cart: CartItem[];
    onUpdateQty: (id: string, delta: number) => void;
    onClear: () => void;
    onCheckout: () => void;
}

export function CartDrawer({ open, onOpenChange, cart, onUpdateQty, onClear, onCheckout }: CartDrawerProps) {
    const totalCents = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetPortal>
                <SheetOverlay />
                <SheetContent side="bottom" className="flex flex-col">
                    {/* Drag Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-12 h-1.5 rounded-full bg-slate-300" />
                    </div>

                    {/* Header */}
                    <div className="px-4 pb-3 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-slate-900 text-lg">Current Order</h2>
                            <p className="text-sm text-slate-500">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
                        </div>
                        {cart.length > 0 && (
                            <button
                                onClick={onClear}
                                className="text-sm text-red-600 hover:text-red-700 font-medium active:scale-95 transition-transform min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-12">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                                    <circle cx="9" cy="21" r="1" />
                                    <circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                <p className="text-sm">Cart is empty</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-900">{item.name}</div>
                                        <div className="text-sm text-slate-500">${(item.priceCents / 100).toFixed(2)}</div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white rounded-md border border-slate-200 px-2 py-1.5 shadow-sm">
                                        <button
                                            onClick={() => onUpdateQty(item.id, -1)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded active:scale-95 transition-transform"
                                            aria-label="Decrease quantity"
                                        >
                                            <span className="text-xl font-semibold">-</span>
                                        </button>
                                        <span className="w-8 text-center font-medium">{item.qty}</span>
                                        <button
                                            onClick={() => onUpdateQty(item.id, 1)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded active:scale-95 transition-transform"
                                            aria-label="Increase quantity"
                                        >
                                            <span className="text-xl font-semibold">+</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer with Total and Checkout */}
                    <div className="px-4 pb-4 pt-3 bg-slate-50 border-t border-slate-200 space-y-4">
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
                            onClick={() => {
                                onCheckout();
                                onOpenChange(false);
                            }}
                        >
                            Checkout ${(totalCents / 100).toFixed(2)}
                        </Button>
                    </div>
                </SheetContent>
            </SheetPortal>
        </Sheet>
    );
}
