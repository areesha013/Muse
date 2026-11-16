import type { Product } from "@/lib/catalog";

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export type ShopParams = {
  q: string;
  category: string; // category slug, "bundles", or "" for all
  min: number | null;
  max: number | null;
  inStock: boolean;
  sort: SortKey;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const toPrice = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Turns the web address (?q=...&sort=...) into safe, known values.
export function parseShopParams(raw: RawParams): ShopParams {
  const sort = first(raw.sort);
  return {
    q: first(raw.q).trim().slice(0, 80),
    category: first(raw.category).trim().toLowerCase().slice(0, 60),
    min: toPrice(first(raw.min)),
    max: toPrice(first(raw.max)),
    inStock: first(raw.stock) === "1",
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as SortKey) : "newest",
  };
}

export function filterAndSort(products: Product[], p: ShopParams): Product[] {
  const words = p.q.toLowerCase().split(/\s+/).filter(Boolean);

  const result = products.filter((item) => {
    if (p.category === "bundles") {
      if (!item.isBundle) return false;
    } else if (p.category && item.category?.slug !== p.category) {
      return false;
    }
    if (p.inStock && !item.inStock) return false;
    if (p.min !== null && item.price < p.min) return false;
    if (p.max !== null && item.price > p.max) return false;
    if (words.length) {
      const haystack = `${item.name} ${item.description ?? ""} ${item.category?.name ?? ""}`.toLowerCase();
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });

  const sorted = [...result];
  switch (p.sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return sorted;
}
