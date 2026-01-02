"use client";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

type Product = {
    id: string;
    name: string;
    description?: string | null;
    priceCents: number;
    imageUrl?: string | null;
    stock?: number;
    posStockQty?: number;
    onlineStockQty?: number;
    channelInventoryMode?: "shared" | "split";
    lowStockAlert?: number | null;
    afterHoursAllowed?: boolean;
    // Location-aware fields
    effectivePriceCents?: number;
    effectiveStock?: number | null;
};

interface ProductCardProps {
    product: Product;
    onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
    // Use location-aware effective values if available, otherwise fall back to legacy logic
    const hasEffectiveStock = product.effectiveStock !== undefined;
    const displayPrice = product.effectivePriceCents ?? product.priceCents;
    const hasPriceOverride = product.effectivePriceCents !== undefined && product.effectivePriceCents !== product.priceCents;

    // Stock calculation - prefer effectiveStock when available
    const mode = product.channelInventoryMode || "shared";
    const sharedStock = product.stock ?? product.posStockQty ?? 0;
    const posStock = product.posStockQty ?? product.stock ?? 0;
    const onlineStock = product.onlineStockQty ?? product.stock ?? 0;
    const effectiveStock = hasEffectiveStock ? (product.effectiveStock ?? 0) : sharedStock;

    const hasStock = hasEffectiveStock
        ? (product.effectiveStock === null || (product.effectiveStock ?? 0) > 0)
        : (mode === "split" ? (posStock > 0 || onlineStock > 0) : sharedStock > 0);

    const lowStock =
        product.lowStockAlert !== undefined &&
        product.lowStockAlert !== null &&
        (hasEffectiveStock
            ? ((product.effectiveStock ?? 0) <= product.lowStockAlert)
            : ((mode === "split" ? Math.min(posStock, onlineStock) : sharedStock) <= product.lowStockAlert));

    return (
        <button
            onClick={hasStock ? onClick : undefined}
            disabled={!hasStock}
            aria-label={hasStock ? `Add ${product.name} to cart, $${(displayPrice / 100).toFixed(2)}` : `${product.name} is out of stock`}
            className={cn(
                "group flex flex-col text-left bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-all duration-200 h-full min-h-[200px]",
                "focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 outline-none",
                hasStock && "hover:shadow-lg hover:border-emerald-200 hover:-translate-y-0.5 active:scale-[0.97] active:shadow-sm cursor-pointer",
                !hasStock && "opacity-50 cursor-not-allowed grayscale"
            )}
        >
            <div className="aspect-[4/3] w-full bg-muted relative overflow-hidden">
                {product.imageUrl ? (
                    <img
                        src={product.imageUrl}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                    </div>
                )}
                {!hasStock && (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">Out of Stock</span>
                    </div>
                )}
                {/* Add to cart overlay on hover */}
                {hasStock && (
                    <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/10 transition-colors duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-200 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
                            + Add to Cart
                        </div>
                    </div>
                )}
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between w-full">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground line-clamp-2 leading-tight mb-1">
                        {product.name}
                    </h3>
                    {product.afterHoursAllowed && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px] h-6">
                            After Hours
                        </Badge>
                    )}
                </div>
                {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
                )}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700 text-lg">
                            ${(displayPrice / 100).toFixed(2)}
                        </span>
                        {hasPriceOverride && (
                            <span className="text-xs text-muted-foreground line-through">
                                ${(product.priceCents / 100).toFixed(2)}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
                        {hasEffectiveStock ? (
                            product.effectiveStock === null ? (
                                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                                    Unlimited
                                </span>
                            ) : (
                                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                                    Stock: {Math.max(0, effectiveStock)}
                                </span>
                            )
                        ) : mode === "split" ? (
                            <>
                                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                                    POS: {Math.max(0, posStock)}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                                    Online: {Math.max(0, onlineStock)}
                                </span>
                            </>
                        ) : (
                            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                                Stock: {Math.max(0, sharedStock)}
                            </span>
                        )}
                        {lowStock && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 font-medium">
                                Low stock
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}
