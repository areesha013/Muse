import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ rating, size = 16, className }: { rating: number; size?: number; className?: string }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const full = rounded >= n;
        const half = !full && rounded >= n - 0.5;
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-neutral-300" aria-hidden />
            {(full || half) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: full ? "100%" : "50%" }}>
                <Star size={size} className="fill-accent-ink text-accent-ink" aria-hidden />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
