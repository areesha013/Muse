import { BadgeCheck } from "lucide-react";
import type { Review } from "@/lib/catalog";
import { reviewStats } from "@/lib/catalog";
import { StarRating } from "@/components/star-rating";

export function ReviewsList({ reviews, children }: { reviews: Review[]; children?: React.ReactNode }) {
  const { count, average } = reviewStats(reviews);

  return (
    <section aria-labelledby="reviews-heading" className="mt-16 border-t border-neutral-200 pt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews-heading" className="text-xl font-semibold">
          Reviews
        </h2>
        {count > 0 && (
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <StarRating rating={average} />
            {average.toFixed(1)} ({count})
          </p>
        )}
      </div>

      {count === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No reviews yet. Be the first once you&apos;ve received your order.</p>
      ) : (
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl bg-cream p-5">
              <StarRating rating={r.rating} />
              {r.title && <p className="mt-2 font-medium">{r.title}</p>}
              {r.body && <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{r.body}</p>}
              {r.photos.length > 0 && (
                <ul className="mt-3 flex gap-2">
                  {r.photos.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noopener noreferrer" aria-label="Open this photo in a new tab">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={`Photo from ${r.author}`} width={72} height={72} loading="lazy" className="h-[72px] w-[72px] rounded-lg object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-neutral-600">
                <span>{r.author}</span>
                {r.verified && (
                  <span className="inline-flex items-center gap-1 text-green-800">
                    <BadgeCheck size={14} aria-hidden /> Verified purchase
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
