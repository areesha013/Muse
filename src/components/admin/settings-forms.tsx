"use client";

import { useState, useTransition } from "react";
import {
  savePaymentSettings,
  saveShippingSettings,
  saveStoreSettings,
  type PaymentSettingsInput,
  type ShippingSettingsInput,
  type StoreSettingsInput,
} from "@/app/actions/admin-settings";
import type { ActionResult } from "@/lib/admin";
import { btnPrimary, Check, Field, inputCls, Message } from "@/components/admin/ui";

function useSave() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message ?? "" });
    });
  return { msg, pending, run };
}

const card = "rounded-2xl border border-neutral-200 p-5 space-y-4";

export function StoreForm({ initial }: { initial: StoreSettingsInput }) {
  const [v, setV] = useState(initial);
  const { msg, pending, run } = useSave();
  const set = (k: keyof StoreSettingsInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => saveStoreSettings(v)); }} className={card}>
      <h2 className="font-semibold">Shop details</h2>
      <p className="text-sm text-neutral-600">Shown in the footer and contact page.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="s-name" label="Shop name"><input id="s-name" value={v.name} onChange={set("name")} className={inputCls} /></Field>
        <Field id="s-email" label="Email"><input id="s-email" type="email" value={v.email} onChange={set("email")} className={inputCls} /></Field>
        <Field id="s-phone" label="Phone"><input id="s-phone" value={v.phone} onChange={set("phone")} className={inputCls} /></Field>
        <Field id="s-ig" label="Instagram link" hint="optional"><input id="s-ig" value={v.instagram} onChange={set("instagram")} placeholder="https://instagram.com/yourname" className={inputCls} /></Field>
      </div>
      <Field id="s-addr" label="Address or city"><input id="s-addr" value={v.address} onChange={set("address")} className={inputCls} /></Field>
      <Message msg={msg} />
      <button disabled={pending} className={btnPrimary}>{pending ? "Saving..." : "Save"}</button>
    </form>
  );
}

type CityRow = { city: string; rate: string };

export function ShippingForm({ initial }: { initial: { flat_rate: number; free_shipping_over: number | null; use_city_rates: boolean; city_rates: Record<string, number>; other_city_rate: number } }) {
  const [flat, setFlat] = useState(String(initial.flat_rate));
  const [freeOver, setFreeOver] = useState(initial.free_shipping_over ? String(initial.free_shipping_over) : "");
  const [useCity, setUseCity] = useState(initial.use_city_rates);
  const [other, setOther] = useState(String(initial.other_city_rate));
  const [cities, setCities] = useState<CityRow[]>(Object.entries(initial.city_rates).map(([city, rate]) => ({ city, rate: String(rate) })));
  const { msg, pending, run } = useSave();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));
    const input: ShippingSettingsInput = {
      flat_rate: num(flat),
      free_shipping_over: freeOver.trim() === "" ? null : num(freeOver),
      use_city_rates: useCity,
      other_city_rate: num(other),
      city_rates: cities.filter((c) => c.city.trim()).map((c) => ({ city: c.city, rate: num(c.rate) })),
    };
    if ([input.flat_rate, input.other_city_rate, ...input.city_rates.map((c) => c.rate)].some((n) => Number.isNaN(n)) || (input.free_shipping_over !== null && Number.isNaN(input.free_shipping_over))) {
      run(async () => ({ ok: false, message: "Please enter shipping amounts as numbers, like 250." }));
      return;
    }
    run(() => saveShippingSettings(input));
  }

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="font-semibold">Shipping (Rs)</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sh-flat" label="Delivery fee"><input id="sh-flat" inputMode="numeric" value={flat} onChange={(e) => setFlat(e.target.value)} className={inputCls} /></Field>
        <Field id="sh-free" label="Free delivery on orders over" hint="empty = never free">
          <input id="sh-free" inputMode="numeric" value={freeOver} onChange={(e) => setFreeOver(e.target.value)} placeholder="3000" className={inputCls} />
        </Field>
      </div>
      <Check id="sh-city" label="Charge different amounts for different cities" hint="Otherwise every city pays the delivery fee above." checked={useCity} onChange={setUseCity} />
      {useCity && (
        <div className="space-y-3 rounded-xl bg-cream p-4">
          {cities.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`City ${i + 1}`} value={c.city} onChange={(e) => setCities(cities.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} placeholder="City" className="h-10 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm" />
              <input aria-label={`Fee for city ${i + 1}`} inputMode="numeric" value={c.rate} onChange={(e) => setCities(cities.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} placeholder="Rs" className="h-10 w-24 rounded-lg border border-neutral-300 bg-white px-3 text-sm" />
              <button type="button" onClick={() => setCities(cities.filter((_, j) => j !== i))} className="px-2 text-sm text-red-700 underline">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => setCities([...cities, { city: "", rate: "" }])} className="text-sm font-medium underline">Add a city</button>
          <Field id="sh-other" label="All other cities"><input id="sh-other" inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      <Message msg={msg} />
      <button disabled={pending} className={btnPrimary}>{pending ? "Saving..." : "Save"}</button>
    </form>
  );
}

const PLACEHOLDER = /your name|your bank|03xx|0000000000|xxxx/i;

export function PaymentsForm({ initial }: { initial: PaymentSettingsInput }) {
  const [v, setV] = useState<PaymentSettingsInput>(initial);
  const { msg, pending, run } = useSave();
  const wallet = (k: "jazzcash" | "easypaisa", f: "enabled" | "account_title" | "number", val: string | boolean) => setV({ ...v, [k]: { ...v[k], [f]: val } });
  const bank = (f: "enabled" | "bank_name" | "account_title" | "account_number" | "iban", val: string | boolean) => setV({ ...v, bank_transfer: { ...v.bank_transfer, [f]: val } });
  const stillPlaceholder = [
    v.jazzcash.enabled && PLACEHOLDER.test(`${v.jazzcash.account_title} ${v.jazzcash.number}`),
    v.easypaisa.enabled && PLACEHOLDER.test(`${v.easypaisa.account_title} ${v.easypaisa.number}`),
    v.bank_transfer.enabled && PLACEHOLDER.test(`${v.bank_transfer.bank_name} ${v.bank_transfer.account_title} ${v.bank_transfer.account_number} ${v.bank_transfer.iban}`),
  ].some(Boolean);

  const walletBlock = (k: "jazzcash" | "easypaisa", label: string) => (
    <fieldset className="space-y-3 rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <Check id={`${k}-on`} label={`Accept ${label}`} checked={v[k].enabled} onChange={(c) => wallet(k, "enabled", c)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${k}-title`} label="Account name"><input id={`${k}-title`} value={v[k].account_title} onChange={(e) => wallet(k, "account_title", e.target.value)} className={inputCls} /></Field>
        <Field id={`${k}-num`} label="Account number"><input id={`${k}-num`} value={v[k].number} onChange={(e) => wallet(k, "number", e.target.value)} className={inputCls} /></Field>
      </div>
    </fieldset>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => savePaymentSettings(v)); }} className={card}>
      <h2 className="font-semibold">Payment methods</h2>
      <p className="text-sm text-neutral-600">Customers see these account details after they place an order. Anyone can see them, so only use accounts meant for receiving money.</p>
      {stillPlaceholder && (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some details are still placeholders (like &quot;Your Name&quot;). Replace them before you open the shop, or turn that method off.
        </p>
      )}
      <fieldset className="rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">Cash on delivery</legend>
        <Check id="cod-on" label="Accept cash on delivery" checked={v.cod.enabled} onChange={(c) => setV({ ...v, cod: { enabled: c } })} />
      </fieldset>
      {walletBlock("jazzcash", "JazzCash")}
      {walletBlock("easypaisa", "Easypaisa")}
      <fieldset className="space-y-3 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">Bank transfer</legend>
        <Check id="bank-on" label="Accept bank transfer" checked={v.bank_transfer.enabled} onChange={(c) => bank("enabled", c)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bank-name" label="Bank"><input id="bank-name" value={v.bank_transfer.bank_name} onChange={(e) => bank("bank_name", e.target.value)} className={inputCls} /></Field>
          <Field id="bank-title" label="Account name"><input id="bank-title" value={v.bank_transfer.account_title} onChange={(e) => bank("account_title", e.target.value)} className={inputCls} /></Field>
          <Field id="bank-num" label="Account number"><input id="bank-num" value={v.bank_transfer.account_number} onChange={(e) => bank("account_number", e.target.value)} className={inputCls} /></Field>
          <Field id="bank-iban" label="IBAN"><input id="bank-iban" value={v.bank_transfer.iban} onChange={(e) => bank("iban", e.target.value)} className={inputCls} /></Field>
        </div>
      </fieldset>
      <Message msg={msg} />
      <button disabled={pending} className={btnPrimary}>{pending ? "Saving..." : "Save"}</button>
    </form>
  );
}
