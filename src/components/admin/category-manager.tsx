"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory, saveCategory } from "@/app/actions/admin-products";
import { slugify } from "@/lib/slug";
import { btnOutline, btnPrimary, Check, Field, inputCls, Message } from "@/components/admin/ui";

export type Cat = { id: string | null; name: string; slug: string; description: string; sort_order: number; is_active: boolean };

function CategoryRow({ cat, isNew }: { cat: Cat; isNew?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(cat);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const id = cat.id ?? "new";

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveCategory({ ...v, id: cat.id, slug: v.slug || undefined });
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) {
        if (isNew) setV({ id: null, name: "", slug: "", description: "", sort_order: 0, is_active: true });
        setSlugTouched(!isNew);
        router.refresh();
      }
    });
  }
  function del() {
    start(async () => {
      const r = await deleteCategory(cat.id!);
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-neutral-200 p-4" aria-label={isNew ? "Add a category" : `Category ${cat.name}`}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
        <Field id={`c-name-${id}`} label="Name">
          <input id={`c-name-${id}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value, slug: slugTouched ? v.slug : slugify(e.target.value) })} className={inputCls} />
        </Field>
        <Field id={`c-slug-${id}`} label="Web address" hint="/shop?category=...">
          <input id={`c-slug-${id}`} value={v.slug} onChange={(e) => { setSlugTouched(true); setV({ ...v, slug: e.target.value.toLowerCase() }); }} className={inputCls} />
        </Field>
        <Field id={`c-ord-${id}`} label="Order">
          <input id={`c-ord-${id}`} inputMode="numeric" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={inputCls} />
        </Field>
      </div>
      <Field id={`c-desc-${id}`} label="Short description" hint="optional">
        <input id={`c-desc-${id}`} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={inputCls} />
      </Field>
      <Check id={`c-act-${id}`} label="Show in the shop" checked={v.is_active} onChange={(c) => setV({ ...v, is_active: c })} />
      <Message msg={msg} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={isNew ? btnPrimary : btnOutline}>{pending ? "Saving..." : isNew ? "Add category" : "Save"}</button>
        {!isNew && !confirmDel && (
          <button type="button" onClick={() => setConfirmDel(true)} className="text-sm font-medium text-red-700 underline">Delete</button>
        )}
        {!isNew && confirmDel && (
          <span role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
            Delete this category? Its products stay, with no category.
            <button type="button" disabled={pending} onClick={del} className="rounded-full bg-red-700 px-4 py-1 font-medium text-white">Yes, delete</button>
            <button type="button" onClick={() => setConfirmDel(false)} className="underline">No</button>
          </span>
        )}
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  return (
    <div className="space-y-4">
      <section aria-labelledby="add-cat" className="rounded-2xl bg-cream p-1">
        <h2 id="add-cat" className="px-4 pt-3 font-semibold">Add a category</h2>
        <div className="p-3">
          <CategoryRow isNew cat={{ id: null, name: "", slug: "", description: "", sort_order: categories.length + 1, is_active: true }} />
        </div>
      </section>
      {categories.map((c) => (
        <CategoryRow key={c.id} cat={c} />
      ))}
    </div>
  );
}
