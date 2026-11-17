import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPKR, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 30;

type P = { id: string; name: string; base_price: number; is_active: boolean; is_bundle: boolean; track_stock: boolean; stock_quantity: number; category_id: string | null };

export default async function ProductsPage({ searchParams }: { searchParams: { q?: string; category?: string; show?: string; page?: string } }) {
  const supabase = createClient();
  const q = (searchParams.q ?? "").replace(/[^a-zA-Z0-9 &'.-]/g, "").trim().slice(0, 60);
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);
  const show = searchParams.show === "hidden" ? "hidden" : "all";

  const { data: cats } = await supabase.from("categories").select("id, name").order("sort_order");
  const catName = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]));
  const category = catName.has(searchParams.category ?? "") ? searchParams.category! : "";

  let query = supabase
    .from("products")
    .select("id, name, base_price, is_active, is_bundle, track_stock, stock_quantity, category_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("name", `%${q}%`);
  if (category) query = query.eq("category_id", category);
  if (show === "hidden") query = query.eq("is_active", false);
  const { data, count } = await query;
  const products = (data ?? []) as P[];
  const ids = products.map((p) => p.id);

  const thumbs = new Map<string, string>();
  const variantStock = new Map<string, { total: number; n: number }>();
  if (ids.length) {
    const [{ data: imgs }, { data: vars }] = await Promise.all([
      supabase.from("product_images").select("product_id, url, sort_order").in("product_id", ids).order("sort_order"),
      supabase.from("product_variants").select("product_id, stock_quantity, is_active").in("product_id", ids),
    ]);
    for (const i of imgs ?? []) if (!thumbs.has(i.product_id as string)) thumbs.set(i.product_id as string, i.url as string);
    for (const v of vars ?? []) {
      if (!v.is_active) continue;
      const cur = variantStock.get(v.product_id as string) ?? { total: 0, n: 0 };
      cur.total += Number(v.stock_quantity); cur.n += 1;
      variantStock.set(v.product_id as string, cur);
    }
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { q: q || null, category: category || null, show: show === "hidden" ? "hidden" : null, page: null, ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Link href="/admin/products/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-700">
          <Plus size={16} aria-hidden /> Add product
        </Link>
      </div>

      <form action="/admin/products" role="search" className="flex flex-wrap gap-2">
        {show === "hidden" && <input type="hidden" name="show" value="hidden" />}
        <label htmlFor="prod-search" className="sr-only">Search products</label>
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input id="prod-search" name="q" defaultValue={q} placeholder="Search by name" className="h-10 w-full rounded-full border border-neutral-300 pl-9 pr-4 text-sm placeholder:text-neutral-500" />
        </div>
        <label htmlFor="prod-cat" className="sr-only">Category</label>
        <select id="prod-cat" name="category" defaultValue={category} className="h-10 rounded-full border border-neutral-300 bg-white px-4 text-sm">
          <option value="">All categories</option>
          {(cats ?? []).map((c) => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}
        </select>
        <button className="h-10 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-700">Filter</button>
        <Link href={href({ show: show === "hidden" ? null : "hidden" })} className={cn("inline-flex h-10 items-center rounded-full border px-4 text-sm", show === "hidden" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100")}>
          Hidden only
        </Link>
      </form>

      {products.length === 0 ? (
        <p className="rounded-2xl bg-cream px-6 py-12 text-center text-neutral-600">No products found.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {products.map((p) => {
            const vs = variantStock.get(p.id);
            const stockText = vs ? `${vs.total} in stock · ${vs.n} options` : !p.track_stock ? "Made to order" : p.stock_quantity === 0 ? "Sold out" : `${p.stock_quantity} in stock`;
            const out = vs ? vs.total === 0 : p.track_stock && p.stock_quantity === 0;
            const thumb = thumbs.get(p.id);
            return (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb ? <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-neutral-100 object-cover" /> : <span className="h-14 w-14 shrink-0 rounded-lg bg-neutral-100" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-sm text-neutral-600">
                      {p.category_id ? catName.get(p.category_id) : p.is_bundle ? "Bundle" : "No category"}
                    </span>
                  </span>
                  <span className="hidden text-sm sm:block">{formatPKR(Number(p.base_price))}</span>
                  <span className="text-right text-sm">
                    <span className="block sm:hidden">{formatPKR(Number(p.base_price))}</span>
                    <span className={out ? "font-medium text-red-700" : "text-neutral-600"}>{stockText}</span>
                    {!p.is_active && <span className="mt-0.5 block text-xs font-medium text-neutral-700">Hidden</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="underline">Previous</Link> : <span />}
          <span className="text-neutral-600">Page {page} of {pages} · {total} products</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="underline">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
