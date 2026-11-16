import Image from "next/image";
import { cn } from "@/lib/utils";

// Fills its parent. The parent must be `relative` and have a size or aspect ratio.
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.endsWith(".svg")}
      className={cn("object-cover", className)}
    />
  );
}
