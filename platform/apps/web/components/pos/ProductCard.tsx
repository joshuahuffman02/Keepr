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
};

interface ProductCardProps {
    product: Product;
    onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
    const mode = product.channelInventoryMode || "shared";
    const sharedStock = product.stock ?? product.posStockQty ?? 0;
    const posStock = product.posStockQty ?? product.stock ?? 0;
    const onlineStock = product.onlineStockQty ?? product.stock ?? 0;
    const hasStock =
        mode === "split"
            ? (posStock > 0 || onlineStock > 0)
            : sharedStock > 0;
    const lowStock =
        product.lowStockAlert !== undefined &&
        product.lowStockAlert !== null &&
        ((mode === "split"
            ? Math.min(posStock, onlineStock)
            : sharedStock) <= product.lowStockAlert);

    return (
        <button
            onClick={hasStock ? onClick : undefined}
            disabled={!hasStock}
            className={cn(
                "flex flex-col text-left bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] h-full min-h-[200px]",
                !hasStock && "opacity-50 cursor-not-allowed grayscale"
            )}
        >
            <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                {product.imageUrl ? (
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
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
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between w-full">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 line-clamp-2 leading-tight mb-1">
                        {product.name}
                    </h3>
                    {product.afterHoursAllowed && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px] h-6">
                            After Hours
                        </Badge>
                    )}
                </div>
                {product.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{product.description}</p>
                )}
                <div className="space-y-2">
                    <div className="font-bold text-emerald-700 text-lg">
                        ${(product.priceCents / 100).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-600 flex flex-wrap gap-2">
                        {mode === "split" ? (
                            <>
                                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5">
                                    POS: {Math.max(0, posStock)}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5">
                                    Online: {Math.max(0, onlineStock)}
                                </span>
                            </>
                        ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5">
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
