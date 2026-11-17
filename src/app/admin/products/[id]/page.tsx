import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";
import { ImageManager } from "@/components/admin/image-manager";
import { VariantManager } from "@/components/admin/variant-manager";

export const metadata: Metadata = { title: "Edit product" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params, searchParams }: { params: { id: string }; searchParams: { created?: string } }) {
  if (!UUID.test(params.id)) notFound();
  const supabase = createClient();
  const { data: p } = await supabase.from("products").select("*").eq("id", params.id).maybeSingle();
  if (!p) notFound();

  const [{ data: cats }, { data: imgs }, { data: vars }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("product_images").select("id, url, alt").eq("product_id", params.id).order("sort_order"),
    supabase.from("product_variants").select("id, name, sku, price_override, stock_quantity, is_active").eq("product_id", params.id).order("sort_order"),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:underline"><ArrowLeft size={14} aria-hidden /> All products</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{p.name as string}</h1>
        {p.is_active && (
          <Link href={`/product/${p.slug as string}`} target="_blank" className="inline-flex items-center gap-1 text-sm underline">
            View in shop <ExternalLink size={14} aria-hidden />
          </Link>
        )}
      </div>
      {searchParams.created === "1" && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">Product created. Add photos below. If it comes in versions (color, size), add options too.</p>
      )}

      <ProductForm
        categories={(cats ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        hasVariants={(vars ?? []).length > 0}
        initial={{
          id: p.id as string,
          name: p.name as string,
          slug: p.slug as string,
          category_id: (p.category_id as string | null) ?? "",
          description: (p.description as string | null) ?? "",
          base_price: String(Number(p.base_price)),
          compare_at_price: p.compare_at_price === null ? "" : String(Number(p.compare_at_price)),
          is_bundle: Boolean(p.is_bundle),
          is_featured: Boolean(p.is_featured),
          is_active: Boolean(p.is_active),
          track_stock: Boolean(p.track_stock),
          stock_quantity: String(p.stock_quantity),
        }}
      />
      <ImageManager productId={p.id as string} images={(imgs ?? []).map((i) => ({ id: i.id as string, url: i.url as string, alt: (i.alt as string | null) ?? null }))} />
      <VariantManager
        productId={p.id as string}
        variants={(vars ?? []).map((v) => ({
          id: v.id as string,
          name: v.name as string,
          sku: (v.sku as string | null) ?? "",
          price_override: v.price_override === null ? "" : String(Number(v.price_override)),
          stock_quantity: String(v.stock_quantity),
          is_active: Boolean(v.is_active),
        }))}
      />
    </div>
  );
}
