import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CategoryManager, type Cat } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { data } = await createClient().from("categories").select("id, name, slug, description, sort_order, is_active").order("sort_order");
  const cats: Cat[] = (data ?? []).map((c) => ({
    id: c.id as string, name: c.name as string, slug: c.slug as string,
    description: (c.description as string | null) ?? "", sort_order: Number(c.sort_order), is_active: Boolean(c.is_active),
  }));
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-neutral-600">Groups like Stickers or Crochet. Lower &quot;Order&quot; numbers show first.</p>
      </div>
      <CategoryManager categories={cats} />
    </div>
  );
}
