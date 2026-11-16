"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

export function ProductGallery({ images }: { images: { url: string; alt: string }[] }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
        <ProductImage src={current.url} alt={current.alt} sizes="(min-width: 768px) 50vw, 100vw" priority />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`}>
              <button
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-cream",
                  i === index ? "border-neutral-900" : "border-transparent"
                )}
              >
                <ProductImage src={img.url} alt="" sizes="100px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
