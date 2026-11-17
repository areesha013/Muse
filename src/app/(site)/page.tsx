import Link from "next/link";
import { Hand, Package, Wallet } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getApprovedReviews, getCatalog, getCategories } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";
import { NewsletterForm } from "@/components/newsletter-form";

export const revalidate = 60;

export default async function Home() {
  const [products, categories, reviews] = await Promise.all([getCatalog(), getCategories(), getApprovedReviews()]);

  const featured = products.filter((p) => p.isFeatured && !p.isBundle).slice(0, 8);
  const bundles = products.filter((p) => p.isBundle).slice(0, 4);
  const latestReviews = reviews.slice(0, 3);
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  return (
    <>
      {/* Hero */}
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent-ink">{siteConfig.hero.eyebrow}</p>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            {siteConfig.hero.headline}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-neutral-600">{siteConfig.hero.subtext}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/shop" className="rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white hover:bg-neutral-700">
              Shop all
            </Link>
            <Link
              href="/shop?category=bundles"
              className="rounded-full border border-neutral-900 px-8 py-3 text-sm font-medium hover:bg-white"
            >
              View bundles
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section aria-label="Why shop with us" className="border-b border-neutral-200">
        <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm sm:grid-cols-3 sm:px-6">
          <li className="flex items-center gap-3"><Hand size={20} aria-hidden className="text-accent-ink" /> Handmade, one at a time</li>
          <li className="flex items-center gap-3"><Package size={20} aria-hidden className="text-accent-ink" /> Delivered across Pakistan</li>
          <li className="flex items-center gap-3"><Wallet size={20} aria-hidden className="text-accent-ink" /> Cash on delivery available</li>
        </ul>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section aria-labelledby="categories-heading" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
          <h2 id="categories-heading" className="text-2xl font-semibold tracking-tight">Shop by category</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {categories.map((c) => {
              const count = products.filter((p) => p.category?.slug === c.slug).length;
              return (
                <li key={c.id}>
                  <Link
                    href={`/shop?category=${c.slug}`}
                    className="group flex h-full min-h-36 flex-col justify-between rounded-2xl bg-accent-soft p-6 transition-colors hover:bg-accent"
                  >
                    <div>
                      <h3 className="text-lg font-semibold">{c.name}</h3>
                      {c.description && <p className="mt-1 text-sm text-neutral-700">{c.description}</p>}
                    </div>
                    <p className="mt-4 text-sm font-medium text-accent-ink group-hover:text-neutral-900">
                      {count} {count === 1 ? "item" : "items"} &rarr;
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Featured */}
      <section aria-labelledby="featured-heading" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 id="featured-heading" className="text-2xl font-semibold tracking-tight">Featured</h2>
          <Link href="/shop" className="text-sm text-accent-ink underline">View all</Link>
        </div>
        {featured.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-cream px-6 py-12 text-center text-neutral-600">
            We&apos;re stocking the shelves. Please check back soon.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </section>

      {/* Bundles */}
      {bundles.length > 0 && (
        <section aria-labelledby="bundles-heading" className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
          <div className="rounded-3xl bg-cream px-6 py-12 sm:px-10">
            <div className="flex items-end justify-between">
              <div>
                <h2 id="bundles-heading" className="text-2xl font-semibold tracking-tight">Bundles and gift sets</h2>
                <p className="mt-1 text-neutral-600">Save more and skip the gift wrapping.</p>
              </div>
              <Link href="/shop?category=bundles" className="text-sm text-accent-ink underline">View all</Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {bundles.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Reviews (only shown once customers have approved reviews) */}
      {latestReviews.length > 0 && (
        <section aria-labelledby="reviews-heading" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
          <h2 id="reviews-heading" className="text-2xl font-semibold tracking-tight">Loved by customers</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {latestReviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 p-6">
                <StarRating rating={r.rating} />
                {r.title && <p className="mt-3 font-medium">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm text-neutral-700">{r.body}</p>}
                <p className="mt-4 text-xs text-neutral-600">
                  {r.author}
                  {nameById.get(r.productId) && <> on {nameById.get(r.productId)}</>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Newsletter */}
      <section aria-labelledby="newsletter-heading" className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl bg-accent-soft px-6 py-14 text-center">
          <h2 id="newsletter-heading" className="text-2xl font-semibold tracking-tight">Join the {siteConfig.name} list</h2>
          <p className="mx-auto mt-2 max-w-md text-neutral-700">New drops, restocks and the occasional discount code, straight to your inbox.</p>
          <div className="mt-6">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
