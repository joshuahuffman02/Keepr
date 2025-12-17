"use client";

import { ProductCard } from "./ProductCard";

type Product = {
    id: string;
    name: string;
    description?: string | null;
    priceCents: number;
    imageUrl?: string | null;
    categoryId?: string | null;
    stock?: number;
};

interface ProductGridProps<T extends Product> {
    products: T[];
    onAdd: (product: T) => void;
}

export function ProductGrid<T extends Product>({ products, onAdd }: ProductGridProps<T>) {
    if (products.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p>No products found in this category.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-6 md:pb-20">
            {products.map((product) => (
                <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => onAdd(product)}
                />
            ))}
        </div>
    );
}
