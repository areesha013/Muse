"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/components/cart-context";
import { formatPKR } from "@/lib/utils";

export function CartDrawer() {
  const { items, isOpen, close, setQty, remove, subtotal } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, page behind stops scrolling, focus moves into the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Your cart</h2>
          <button ref={closeRef} onClick={close} aria-label="Close cart" className="rounded-full p-2 hover:bg-neutral-100">
            <X size={20} aria-hidden />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
            <p className="text-neutral-600">Your cart is empty.</p>
            <Link
              href="/shop"
              onClick={close}
              className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-neutral-200 overflow-y-auto px-5">
              {items.map((item) => (
                <li key={item.key} className="flex gap-4 py-4">
                  <Link
                    href={`/product/${item.slug}`}
                    onClick={close}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-cream"
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="80px"
                      unoptimized={item.image.endsWith(".svg")}
                      className="object-cover"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.variantName && <p className="text-xs text-neutral-600">{item.variantName}</p>}
                      </div>
                      <button
                        onClick={() => remove(item.key)}
                        aria-label={`Remove ${item.name}`}
                        className="h-fit rounded-full p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full border border-neutral-300">
                        <button
                          onClick={() => setQty(item.key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                          className="p-2 disabled:opacity-40"
                        >
                          <Minus size={14} aria-hidden />
                        </button>
                        <span className="w-6 text-center text-sm" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setQty(item.key, item.quantity + 1)}
                          disabled={item.maxQty !== null && item.quantity >= item.maxQty}
                          aria-label="Increase quantity"
                          className="p-2 disabled:opacity-40"
                        >
                          <Plus size={14} aria-hidden />
                        </button>
                      </div>
                      <p className="text-sm font-medium">{formatPKR(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-neutral-200 px-5 py-4">
              <div className="flex justify-between text-base font-semibold">
                <span>Subtotal</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-600">Shipping and discount codes are added at checkout.</p>
              <Link
                href="/checkout"
                onClick={close}
                className="mt-4 block rounded-full bg-neutral-900 py-3 text-center text-sm font-medium text-white hover:bg-neutral-700"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
