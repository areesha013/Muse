import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { data: cats } = await createClient().from("categories").select("id, name").order("sort_order");
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:underline"><ArrowLeft size={14} aria-hidden /> All products</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
      <p className="text-sm text-neutral-600">Fill in the basics first. After you create it, you can add photos and options.</p>
      <ProductForm
        categories={(cats ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        hasVariants={false}
        initial={{ id: null, name: "", slug: "", category_id: "", description: "", base_price: "", compare_at_price: "", is_bundle: false, is_featured: false, is_active: true, track_stock: true, stock_quantity: "0" }}
      />
    </div>
  );
}
