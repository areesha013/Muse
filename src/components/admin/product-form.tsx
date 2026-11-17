"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct, saveProduct } from "@/app/actions/admin-products";
import { parseMoney, slugify } from "@/lib/slug";
import { btnPrimary, Check, Field, inputCls, Message } from "@/components/admin/ui";

export type ProductFormValues = {
  id: string | null;
  name: string;
  slug: string;
  category_id: string;
  description: string;
  base_price: string;
  compare_at_price: string;
  is_bundle: boolean;
  is_featured: boolean;
  is_active: boolean;
  track_stock: boolean;
  stock_quantity: string;
};

export function ProductForm({ initial, categories, hasVariants }: { initial: ProductFormValues; categories: { id: string; name: string }[]; hasVariants: boolean }) {
  const router = useRouter();
  const isNew = initial.id === null;
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = parseMoney(v.base_price);
    if (base === null) return setMsg({ ok: false, text: "Please enter the price as a number, like 450." });
    const compare = v.compare_at_price.trim() === "" ? null : parseMoney(v.compare_at_price);
    if (v.compare_at_price.trim() !== "" && compare === null) return setMsg({ ok: false, text: "Please enter the old price as a number, or leave it empty." });
    const stock = v.stock_quantity.trim() === "" ? 0 : Number(v.stock_quantity);
    if (!Number.isInteger(stock)) return setMsg({ ok: false, text: "Stock must be a whole number." });

    start(async () => {
      const r = await saveProduct({
        id: v.id,
        name: v.name,
        slug: v.slug || undefined,
        category_id: v.category_id || null,
        description: v.description,
        base_price: base,
        compare_at_price: compare,
        is_bundle: v.is_bundle,
        is_featured: v.is_featured,
        is_active: v.is_active,
        track_stock: v.track_stock,
        stock_quantity: stock,
      });
      if (r.ok && isNew && r.id) {
        router.push(`/admin/products/${r.id}?created=1`);
        return;
      }
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteProduct(v.id!);
      if (r.ok) router.push("/admin/products");
      else setMsg({ ok: false, text: r.message ?? "" });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-neutral-200 p-5" aria-label="Product details">
      <h2 className="font-semibold">Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-name" label="Name">
          <input id="p-name" value={v.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} className={inputCls} />
        </Field>
        <Field id="p-slug" label="Web address" hint="/product/...">
          <input id="p-slug" value={v.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} className={inputCls} />
        </Field>
      </div>
      <Field id="p-cat" label="Category">
        <select id="p-cat" value={v.category_id} onChange={(e) => set("category_id", e.target.value)} className={inputCls}>
          <option value="">No category (for example a bundle)</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field id="p-desc" label="Description">
        <textarea id="p-desc" value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={4000} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-price" label="Price (Rs)"><input id="p-price" inputMode="decimal" value={v.base_price} onChange={(e) => set("base_price", e.target.value)} className={inputCls} /></Field>
        <Field id="p-compare" label="Old price (Rs)" hint="optional, shown crossed out">
          <input id="p-compare" inputMode="decimal" value={v.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl bg-cream p-4">
        <Check id="p-track" label="Count stock for this product" hint="Turn off for made-to-order items. They can always be bought." checked={v.track_stock} onChange={(c) => set("track_stock", c)} />
        {v.track_stock && (
          <Field id="p-stock" label="In stock">
            <input id="p-stock" inputMode="numeric" value={v.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value.replace(/\D/g, ""))} disabled={hasVariants} className={`${inputCls} max-w-40`} />
            {hasVariants && <p className="mt-1 text-xs text-neutral-600">This product has options. Set stock on each option below.</p>}
          </Field>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Check id="p-active" label="Show in the shop" hint="Turn off to hide it." checked={v.is_active} onChange={(c) => set("is_active", c)} />
        <Check id="p-feat" label="Featured" hint="Shown on the home page." checked={v.is_featured} onChange={(c) => set("is_featured", c)} />
        <Check id="p-bundle" label="Bundle or gift set" hint="Listed under Bundles." checked={v.is_bundle} onChange={(c) => set("is_bundle", c)} />
      </div>

      <Message msg={msg} />
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className={btnPrimary}>{pending ? "Saving..." : isNew ? "Create product" : "Save changes"}</button>
        {!isNew && !confirmDel && (
          <button type="button" onClick={() => setConfirmDel(true)} className="text-sm font-medium text-red-700 underline">Delete product</button>
        )}
        {!isNew && confirmDel && (
          <span role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
            Delete for good? Old orders keep their item names. To just hide it, untick &quot;Show in the shop&quot; instead.
            <button type="button" disabled={pending} onClick={remove} className="rounded-full bg-red-700 px-4 py-1 font-medium text-white">Yes, delete</button>
            <button type="button" onClick={() => setConfirmDel(false)} className="underline">No</button>
          </span>
        )}
      </div>
    </form>
  );
}
