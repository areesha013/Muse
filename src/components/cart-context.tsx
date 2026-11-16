"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";

export type CartItem = {
  key: string; // productId + variantId
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  price: number; // for display only. Checkout (Phase 3) re-checks prices on the server.
  image: string;
  quantity: number;
  maxQty: number | null; // stock available, null = unlimited
};

type Action =
  | { type: "load"; items: CartItem[] }
  | { type: "add"; item: Omit<CartItem, "quantity">; quantity: number }
  | { type: "setQty"; key: string; quantity: number }
  | { type: "remove"; key: string }
  | { type: "clear" };

const STORAGE_KEY = "muse-cart-v1";

const clamp = (qty: number, max: number | null) => {
  const capped = max === null ? qty : Math.min(qty, max);
  return Math.max(1, Math.min(capped, 99));
};

export function cartReducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case "load":
      return action.items;
    case "add": {
      const existing = state.find((i) => i.key === action.item.key);
      if (existing) {
        return state.map((i) =>
          i.key === action.item.key
            ? { ...i, ...action.item, quantity: clamp(i.quantity + action.quantity, action.item.maxQty) }
            : i
        );
      }
      return [...state, { ...action.item, quantity: clamp(action.quantity, action.item.maxQty) }];
    }
    case "setQty":
      return state.map((i) => (i.key === action.key ? { ...i, quantity: clamp(action.quantity, i.maxQty) } : i));
    case "remove":
      return state.filter((i) => i.key !== action.key);
    case "clear":
      return [];
  }
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQty: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const [isOpen, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved cart once, in the browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) dispatch({ type: "load", items: parsed });
      }
    } catch {
      // Ignore a broken saved cart.
    }
    setLoaded(true);
  }, []);

  // Save on every change (after the first load).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage can be blocked (private mode). The cart still works until the tab closes.
    }
  }, [items, loaded]);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.price * i.quantity, 0),
      isOpen,
      open,
      close,
      add: (item, quantity = 1) => dispatch({ type: "add", item, quantity }),
      setQty: (key, quantity) => dispatch({ type: "setQty", key, quantity }),
      remove: (key) => dispatch({ type: "remove", key }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [items, isOpen, open, close]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
