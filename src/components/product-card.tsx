import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { formatPKR, cn } from "@/lib/utils";
import { ProductImage } from "@/components/product-image";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const onSale = product.comparePrice !== null && product.comparePrice > product.price;
  const image = product.images[0];

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-cream">
        <ProductImage
          src={image.url}
          alt={image.alt}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className={cn("transition-transform duration-300 group-hover:scale-105", !product.inStock && "opacity-50")}
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {!product.inStock && (
            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">Sold out</span>
          )}
          {product.inStock && onSale && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-neutral-900">Sale</span>
          )}
          {product.isBundle && (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm">
              Bundle
            </span>
          )}
        </div>
      </div>
      <h3 className="mt-3 text-sm font-medium text-neutral-900 group-hover:underline">{product.name}</h3>
      <p className="mt-1 flex items-baseline gap-2 text-sm text-neutral-600">
        <span>{product.price === product.maxPrice ? formatPKR(product.price) : `From ${formatPKR(product.price)}`}</span>
        {onSale && <span className="text-xs text-neutral-500 line-through">{formatPKR(product.comparePrice!)}</span>}
      </p>
    </Link>
  );
}
