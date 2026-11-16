"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Variant } from "@/lib/catalog";
import { useCart } from "@/components/cart-context";
import { cn, formatPKR } from "@/lib/utils";

type Props = {
  product: {
    id: string;
    slug: string;
    name: string;
    image: string;
    comparePrice: number | null;
    basePrice: number; // price when the product has no variants
    stockLeft: number | null; // null = not tracked
    variants: Variant[];
  };
};

export function ProductBuy({ product }: Props) {
  const { add, open } = useCart();
  const hasVariants = product.variants.length > 0;

  const [variantId, setVariantId] = useState<string | null>(
    hasVariants ? (product.variants.find((v) => v.stock > 0) ?? product.variants[0]).id : null
  );
  const [qty, setQty] = useState(1);

  const variant = hasVariants ? product.variants.find((v) => v.id === variantId)! : null;
  const price = variant ? variant.price : product.basePrice;
  const stock = variant ? variant.stock : product.stockLeft; // null = unlimited
  const soldOut = stock !== null && stock <= 0;
  const max = stock === null ? 99 : Math.max(stock, 1);
  const onSale = product.comparePrice !== null && product.comparePrice > price;

  function pickVariant(id: string) {
    setVariantId(id);
    setQty(1);
  }

  function addToCart() {
    if (soldOut) return;
    add(
      {
        key: `${product.id}:${variant?.id ?? "base"}`,
        productId: product.id,
        variantId: variant?.id ?? null,
        slug: product.slug,
        name: product.name,
        variantName: variant?.name ?? null,
        price,
        image: product.image,
        maxQty: stock,
      },
      qty
    );
    open();
  }

  return (
    <div>
      <p className="flex items-baseline gap-3 text-2xl font-semibold">
        {formatPKR(price)}
        {onSale && <span className="text-base font-normal text-neutral-500 line-through">{formatPKR(product.comparePrice!)}</span>}
      </p>

      <p
        className={cn(
          "mt-2 text-sm font-medium",
          soldOut ? "text-red-700" : stock !== null && stock <= 3 ? "text-amber-800" : "text-green-800"
        )}
        role="status"
      >
        {soldOut ? "Sold out" : stock !== null && stock <= 3 ? `Only ${stock} left` : "In stock"}
      </p>

      {hasVariants && (
        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Choose an option</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const selected = v.id === variantId;
              const out = v.stock <= 0;
              return (
                <label
                  key={v.id}
                  className={cn(
                    "cursor-pointer rounded-full border px-4 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                    selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:border-neutral-900",
                    out && !selected && "text-neutral-500 line-through"
                  )}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={selected}
                    onChange={() => pickVariant(v.id)}
                    className="sr-only"
                  />
                  {v.name}
                  {out && <span className="sr-only"> (sold out)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center rounded-full border border-neutral-300">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={soldOut || qty <= 1}
            aria-label="Decrease quantity"
            className="p-3 disabled:opacity-40"
          >
            <Minus size={16} aria-hidden />
          </button>
          <span className="w-8 text-center text-sm" aria-live="polite" aria-label={`Quantity ${qty}`}>
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            disabled={soldOut || qty >= max}
            aria-label="Increase quantity"
            className="p-3 disabled:opacity-40"
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={addToCart}
          disabled={soldOut}
          className="h-12 flex-1 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-700"
        >
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
