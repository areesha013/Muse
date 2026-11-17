import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedReviews, getCatalog, getProductBySlug, reviewStats } from "@/lib/catalog";
import { siteConfig } from "@/config/site";
import { ProductGallery } from "@/components/product-gallery";
import { ProductBuy } from "@/components/product-buy";
import { ProductCard } from "@/components/product-card";
import { ReviewsList } from "@/components/reviews-list";
import { StarRating } from "@/components/star-rating";

export const revalidate = 60;

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  const products = await getCatalog();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) return { title: "Product not found" };
  const description = product.description ?? siteConfig.description;
  const image = product.images[0].url;
  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      type: "website",
      ...(image.startsWith("http") ? { images: [image] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const [product, catalog, allReviews] = await Promise.all([
    getProductBySlug(params.slug),
    getCatalog(),
    getApprovedReviews(),
  ]);
  if (!product) notFound();

  const reviews = allReviews.filter((r) => r.productId === product.id);
  const stats = reviewStats(reviews);
  const related = catalog
    .filter((p) => p.id !== product.id && (product.category ? p.category?.slug === product.category.slug : p.isBundle))
    .slice(0, 4);

  // Search engines read this to show price and stock in results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.map((i) => (i.url.startsWith("http") ? i.url : `${siteConfig.url}${i.url}`)),
    offers: {
      "@type": "Offer",
      priceCurrency: siteConfig.currency,
      price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(stats.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stats.average.toFixed(1), reviewCount: stats.count } }
      : {}),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-neutral-600">
        <Link href="/shop" className="hover:underline">Shop</Link>
        {product.category && (
          <>
            {" / "}
            <Link href={`/shop?category=${product.category.slug}`} className="hover:underline">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <ProductGallery images={product.images} />

        <div>
          {product.isBundle && (
            <span className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium">Bundle</span>
          )}
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
          {stats.count > 0 && (
            <a href="#reviews-heading" className="mt-2 flex items-center gap-2 text-sm text-neutral-600 hover:underline">
              <StarRating rating={stats.average} />
              {stats.average.toFixed(1)} ({stats.count})
            </a>
          )}

          <div className="mt-5">
            <ProductBuy
              key={product.id}
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                image: product.images[0].url,
                comparePrice: product.comparePrice,
                basePrice: product.price,
                stockLeft: product.variants.length ? null : product.stockLeft,
                variants: product.variants,
              }}
            />
          </div>

          {product.description && (
            <div className="mt-8 border-t border-neutral-200 pt-6">
              <h2 className="text-sm font-semibold">Details</h2>
              <p className="mt-2 whitespace-pre-line text-neutral-700">{product.description}</p>
            </div>
          )}

          <ul className="mt-6 space-y-1 text-sm text-neutral-600">
            <li>Handmade in Pakistan</li>
            <li>Cash on delivery available</li>
            <li>Questions? Message us on WhatsApp</li>
          </ul>
        </div>
      </div>

      <ReviewsList reviews={reviews} />

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-16">
          <h2 id="related-heading" className="text-xl font-semibold">
            You might also like
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
