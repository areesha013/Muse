import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getCategories } from "@/lib/catalog";
import { SORT_OPTIONS, filterAndSort, parseShopParams, type ShopParams } from "@/lib/shop";
import { ProductCard } from "@/components/product-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse handmade stickers, crochet keychains, plushies, flowers, bundles and wearables.",
};

export const revalidate = 60;

// Builds a /shop link that keeps the current search, sorting and filters.
function shopHref(current: ShopParams, changes: Partial<Record<"category", string>>) {
  const sp = new URLSearchParams();
  const category = changes.category ?? current.category;
  if (current.q) sp.set("q", current.q);
  if (category) sp.set("category", category);
  if (current.min !== null) sp.set("min", String(current.min));
  if (current.max !== null) sp.set("max", String(current.max));
  if (current.inStock) sp.set("stock", "1");
  if (current.sort !== "newest") sp.set("sort", current.sort);
  const qs = sp.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = parseShopParams(searchParams);
  const [products, categories] = await Promise.all([getCatalog(), getCategories()]);
  const results = filterAndSort(products, params);

  const chips = [
    { slug: "", label: "All" },
    ...categories.map((c) => ({ slug: c.slug, label: c.name })),
    { slug: "bundles", label: "Bundles" },
  ];

  const hasFilters = params.q || params.category || params.min !== null || params.max !== null || params.inStock;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Shop</h1>

      <nav aria-label="Categories" className="mt-6 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = params.category === chip.slug;
          return (
            <Link
              key={chip.slug || "all"}
              href={shopHref(params, { category: chip.slug })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-sm",
                active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-900"
              )}
            >
              {chip.label}
            </Link>
          );
        })}
      </nav>

      <form action="/shop" method="get" className="mt-6 grid gap-4 rounded-2xl bg-cream p-4 sm:grid-cols-2 lg:grid-cols-6">
        {params.category && <input type="hidden" name="category" value={params.category} />}

        <div className="lg:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-neutral-700">Search</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder="Keychain, stickers..."
            className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-500"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="min" className="block text-xs font-medium text-neutral-700">Min price</label>
            <input
              id="min"
              name="min"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={params.min ?? ""}
              placeholder="Rs 0"
              className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-500"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="max" className="block text-xs font-medium text-neutral-700">Max price</label>
            <input
              id="max"
              name="max"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={params.max ?? ""}
              placeholder="Any"
              className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="sort" className="block text-xs font-medium text-neutral-700">Sort by</label>
          <select
            id="sort"
            name="sort"
            defaultValue={params.sort}
            className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={params.inStock} className="h-4 w-4" />
          In stock only
        </label>

        <div className="flex items-end gap-3">
          <button type="submit" className="h-10 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-700">
            Apply
          </button>
          {hasFilters && (
            <Link href="/shop" className="pb-2 text-sm text-accent-ink underline">Clear all</Link>
          )}
        </div>
      </form>

      <p className="mt-6 text-sm text-neutral-600" role="status">
        {results.length} {results.length === 1 ? "product" : "products"}
      </p>

      {results.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-cream px-6 py-16 text-center">
          <p className="font-medium">
            {products.length === 0 ? "We're stocking the shelves. Please check back soon." : "No products match your search."}
          </p>
          {products.length > 0 && (
            <Link href="/shop" className="mt-3 inline-block text-sm text-accent-ink underline">
              See all products
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {results.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
