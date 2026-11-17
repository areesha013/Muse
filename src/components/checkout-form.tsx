"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { placeOrder, quoteCart, type Quote, type QuoteLine } from "@/app/actions/checkout";
import { useCart } from "@/components/cart-context";
import { Turnstile } from "@/components/turnstile";
import { CITIES } from "@/lib/cities";
import type { PaymentMethod } from "@/lib/orders";
import { cn, formatPKR } from "@/lib/utils";

export type MethodOption = { id: PaymentMethod; label: string; hint: string };

const inputClass =
  "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm placeholder:text-neutral-500";

function Field({
  id, label, error, optional, children,
}: { id: string; label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label} {optional && <span className="font-normal text-neutral-600">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? "base"}`;

export function CheckoutForm({ methods }: { methods: MethodOption[] }) {
  const router = useRouter();
  const { items, ready, clear, remove, setQty } = useCart();

  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", address: "", notes: "" });
  const [method, setMethod] = useState<PaymentMethod>(methods[0]?.id ?? "cod");
  const [honeypot, setHoneypot] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);

  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // bump to re-check stock after a failed order
  const [quoting, setQuoting] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errorRef = useRef<HTMLDivElement>(null);

  const cartPayload = useMemo(
    () => items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
    [items]
  );

  // Ask the server for live prices, stock, discount and shipping whenever something changes.
  useEffect(() => {
    if (!ready || cartPayload.length === 0) return;
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(async () => {
      const result = await quoteCart({ items: cartPayload, city: form.city, code: appliedCode });
      if (!cancelled) {
        setQuote(result);
        setQuoting(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, cartPayload, form.city, appliedCode, refreshKey]);

  const quoteLines = useMemo(() => {
    const map = new Map<string, QuoteLine>();
    if (quote?.ok) for (const l of quote.lines) map.set(lineKey(l.productId, l.variantId), l);
    return map;
  }, [quote]);

  const hasProblem = quote?.ok ? quote.lines.some((l) => l.problem) : false;
  const discountApplied = quote?.ok && quote.discountValid === true;
  const canSubmit = ready && items.length > 0 && quote?.ok === true && !hasProblem && !quoting && !submitting;

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((e) => ({ ...e, [field]: "" }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await placeOrder({
      ...form,
      method,
      items: cartPayload,
      code: discountApplied ? appliedCode : "",
      website: honeypot,
      captcha,
    });

    if (result.ok) {
      clear();
      router.push(`/order/${result.token}`);
      return; // stay disabled while the next page loads (prevents double orders)
    }

    setFormError(result.message);
    setCaptchaReset((n) => n + 1); // each security-check token works only once
    setRefreshKey((k) => k + 1); // stock or prices may have changed: re-check the cart
    setFieldErrors(result.fieldErrors ?? {});
    setSubmitting(false);
    setTimeout(() => errorRef.current?.focus(), 50);
  }

  // ---------- Empty / loading cart ----------
  if (!ready) return <p className="py-20 text-center text-neutral-600">Loading your cart...</p>;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-cream px-6 py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <p className="mt-1 text-neutral-600">Add something you like, then come back to check out.</p>
        <Link href="/shop" className="mt-6 inline-block rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white hover:bg-neutral-700">
          Go to shop
        </Link>
      </div>
    );
  }

  const fieldClass = (name: string) => cn(inputClass, fieldErrors[name] ? "border-red-600" : "border-neutral-300");
  const aria = (name: string) => ({
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[1fr_380px]" noValidate>
      {/* ---------- Left: details ---------- */}
      <div className="space-y-8">
        {formError && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError}
          </div>
        )}

        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-lg font-semibold">Contact and delivery</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Full name" error={fieldErrors.name}>
              <input id="name" name="name" autoComplete="name" required value={form.name} onChange={(e) => update("name", e.target.value)} className={fieldClass("name")} {...aria("name")} />
            </Field>
            <Field id="phone" label="Mobile number" error={fieldErrors.phone}>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" required value={form.phone} onChange={(e) => update("phone", e.target.value)} className={fieldClass("phone")} {...aria("phone")} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="email" label="Email" optional error={fieldErrors.email}>
                <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={fieldClass("email")} {...aria("email")} />
              </Field>
            </div>
            <Field id="city" label="City" error={fieldErrors.city}>
              <input id="city" name="city" autoComplete="address-level2" list="city-list" required value={form.city} onChange={(e) => update("city", e.target.value)} className={fieldClass("city")} {...aria("city")} />
              <datalist id="city-list">
                {CITIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <div className="sm:col-span-2">
              <Field id="address" label="Full address" error={fieldErrors.address}>
                <textarea id="address" name="address" autoComplete="street-address" rows={3} placeholder="House, street, area" required value={form.address} onChange={(e) => update("address", e.target.value)} className={cn(fieldClass("address"), "h-auto py-2")} {...aria("address")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="notes" label="Order notes" optional error={fieldErrors.notes}>
                <textarea id="notes" name="notes" rows={2} placeholder="Anything we should know?" value={form.notes} onChange={(e) => update("notes", e.target.value)} className={cn(fieldClass("notes"), "h-auto py-2")} />
              </Field>
            </div>
          </div>
          {/* Spam trap: hidden from people */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </section>

        <fieldset>
          <legend className="text-lg font-semibold">Payment</legend>
          {methods.length === 0 ? (
            <p className="mt-3 text-sm text-red-700">No payment method is available right now. Please contact us on WhatsApp.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {methods.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                    method === m.id ? "border-neutral-900 bg-cream" : "border-neutral-300 hover:border-neutral-900"
                  )}
                >
                  <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-sm text-neutral-600">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />
      </div>

      {/* ---------- Right: summary ---------- */}
      <aside aria-labelledby="summary-heading" className="h-fit rounded-2xl border border-neutral-200 p-6 lg:sticky lg:top-24">
        <h2 id="summary-heading" className="text-lg font-semibold">Order summary</h2>

        <ul className="mt-4 divide-y divide-neutral-200">
          {items.map((item) => {
            const q = quoteLines.get(item.key);
            const unit = q && !q.problem ? q.unitPrice : item.price;
            return (
              <li key={item.key} className="py-4">
                <div className="flex gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-cream">
                    <Image src={item.image} alt="" fill sizes="64px" unoptimized={item.image.endsWith(".svg")} className="object-cover" />
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{item.name}</p>
                    {item.variantName && <p className="text-neutral-600">{item.variantName}</p>}
                    <p className="text-neutral-600">Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium">{formatPKR(unit * item.quantity)}</p>
                </div>

                {q?.problem && (
                  <div role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    {q.problem === "OUT_OF_STOCK" && (q.stock ?? 0) > 0 ? (
                      <>
                        Only {q.stock} left.{" "}
                        <button type="button" onClick={() => setQty(item.key, q.stock ?? 1)} className="font-medium underline">
                          Change to {q.stock}
                        </button>
                      </>
                    ) : q.problem === "OUT_OF_STOCK" ? (
                      <>
                        Sold out.{" "}
                        <button type="button" onClick={() => remove(item.key)} className="font-medium underline">Remove</button>
                      </>
                    ) : (
                      <>
                        This item can&apos;t be ordered right now.{" "}
                        <button type="button" onClick={() => remove(item.key)} className="font-medium underline">Remove</button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Discount code */}
        <div className="mt-4">
          <label htmlFor="code" className="block text-sm font-medium">Discount code</label>
          <div className="mt-1 flex gap-2">
            <input
              id="code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setAppliedCode(codeInput.trim());
                }
              }}
              autoComplete="off"
              className="h-10 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm uppercase"
            />
            <button
              type="button"
              onClick={() => setAppliedCode(codeInput.trim())}
              disabled={!codeInput.trim()}
              className="h-10 rounded-full border border-neutral-900 px-5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
          <p role="status" className={cn("mt-1 min-h-5 text-sm", discountApplied ? "text-green-800" : "text-red-700")}>
            {quote?.ok && appliedCode && quote.discountMessage
              ? discountApplied
                ? `${appliedCode} applied: you save ${formatPKR(quote.discountAmount)}`
                : quote.discountMessage
              : ""}
          </p>
        </div>

        {/* Totals */}
        {quote && !quote.ok ? (
          <p role="alert" className="mt-4 text-sm text-red-700">{quote.message}</p>
        ) : (
          <dl className={cn("mt-2 space-y-2 text-sm", quoting && "opacity-60")} aria-busy={quoting}>
            <div className="flex justify-between">
              <dt className="text-neutral-600">Subtotal</dt>
              <dd>{quote?.ok ? formatPKR(quote.subtotal) : "..."}</dd>
            </div>
            {quote?.ok && quote.discountAmount > 0 && (
              <div className="flex justify-between text-green-800">
                <dt>Discount</dt>
                <dd>-{formatPKR(quote.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-neutral-600">Shipping</dt>
              <dd>{quote?.ok ? (quote.shippingFee > 0 ? formatPKR(quote.shippingFee) : "Free") : "..."}</dd>
            </div>
            <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{quote?.ok ? formatPKR(quote.total) : "..."}</dd>
            </div>
          </dl>
        )}

        <button
          type="submit"
          disabled={!canSubmit || methods.length === 0}
          className="mt-6 h-12 w-full rounded-full bg-neutral-900 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-700"
        >
          {submitting ? "Placing order..." : "Place order"}
        </button>
        {hasProblem && <p className="mt-2 text-sm text-red-700">Please fix the items above to continue.</p>}
        <p className="mt-3 text-xs text-neutral-600">
          By placing your order you agree to our <Link href="/shipping-returns" className="underline">shipping and returns policy</Link>.
        </p>
      </aside>
    </form>
  );
}
