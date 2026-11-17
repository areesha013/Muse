"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVariant, saveVariant } from "@/app/actions/admin-products";
import { parseMoney } from "@/lib/slug";
import { btnOutline, Check, Field, inputCls, Message } from "@/components/admin/ui";

export type Variant = { id: string | null; name: string; sku: string; price_override: string; stock_quantity: string; is_active: boolean };

function VariantRow({ productId, variant, isNew }: { productId: string; variant: Variant; isNew?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(variant);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const key = variant.id ?? "new";

  function save(e: React.FormEvent) {
    e.preventDefault();
    const price = v.price_override.trim() === "" ? null : parseMoney(v.price_override);
    if (v.price_override.trim() !== "" && price === null) return setMsg({ ok: false, text: "Enter the price as a number, or leave it empty to use the product price." });
    const stock = v.stock_quantity.trim() === "" ? 0 : Number(v.stock_quantity);
    start(async () => {
      const r = await saveVariant({ id: variant.id, product_id: productId, name: v.name, sku: v.sku || null, price_override: price, stock_quantity: stock, is_active: v.is_active });
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) {
        if (isNew) setV({ id: null, name: "", sku: "", price_override: "", stock_quantity: "0", is_active: true });
        router.refresh();
      }
    });
  }
  function del() {
    start(async () => {
      const r = await deleteVariant(variant.id!);
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-neutral-200 p-4" aria-label={isNew ? "Add an option" : `Option ${variant.name}`}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px_90px]">
        <Field id={`v-name-${key}`} label="Option name"><input id={`v-name-${key}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Pink, Large..." className={inputCls} /></Field>
        <Field id={`v-price-${key}`} label="Price (Rs)" hint="optional"><input id={`v-price-${key}`} inputMode="decimal" value={v.price_override} onChange={(e) => setV({ ...v, price_override: e.target.value })} placeholder="same as product" className={inputCls} /></Field>
        <Field id={`v-sku-${key}`} label="SKU" hint="optional"><input id={`v-sku-${key}`} value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value })} className={inputCls} /></Field>
        <Field id={`v-stock-${key}`} label="In stock"><input id={`v-stock-${key}`} inputMode="numeric" value={v.stock_quantity} onChange={(e) => setV({ ...v, stock_quantity: e.target.value.replace(/\D/g, "") })} className={inputCls} /></Field>
      </div>
      <Check id={`v-act-${key}`} label="Available to buy" checked={v.is_active} onChange={(c) => setV({ ...v, is_active: c })} />
      <Message msg={msg} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={`${btnOutline} h-10`}>{pending ? "Saving..." : isNew ? "Add option" : "Save"}</button>
        {!isNew && !confirmDel && <button type="button" onClick={() => setConfirmDel(true)} className="text-sm font-medium text-red-700 underline">Delete</button>}
        {!isNew && confirmDel && (
          <span role="alertdialog" aria-label="Confirm delete" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
            Delete this option?
            <button type="button" disabled={pending} onClick={del} className="rounded-full bg-red-700 px-4 py-1 font-medium text-white">Yes</button>
            <button type="button" onClick={() => setConfirmDel(false)} className="underline">No</button>
          </span>
        )}
      </div>
    </form>
  );
}

export function VariantManager({ productId, variants }: { productId: string; variants: Variant[] }) {
  return (
    <section aria-labelledby="var-h" className="space-y-4 rounded-2xl border border-neutral-200 p-5">
      <h2 id="var-h" className="font-semibold">Options (color, size...)</h2>
      <p className="text-sm text-neutral-600">
        Only needed if the product comes in versions. With options, customers must pick one, and stock is counted per option. Leave this empty for a simple product.
      </p>
      {variants.map((v) => <VariantRow key={v.id} productId={productId} variant={v} />)}
      <VariantRow isNew productId={productId} variant={{ id: null, name: "", sku: "", price_override: "", stock_quantity: "0", is_active: true }} />
    </section>
  );
}
