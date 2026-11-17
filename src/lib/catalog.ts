import { createPublicClient } from "@/lib/supabase/public";

// ---------- Types used by the pages ----------
export type Variant = {
  id: string;
  name: string;
  options: Record<string, string>;
  price: number;
  stock: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number; // lowest price (a product with variants may have several)
  maxPrice: number;
  comparePrice: number | null;
  isBundle: boolean;
  isFeatured: boolean;
  category: { name: string; slug: string } | null;
  images: { url: string; alt: string }[];
  variants: Variant[];
  inStock: boolean;
  stockLeft: number | null; // null = stock is not tracked
  createdAt: string;
};

export type Category = { id: string; name: string; slug: string; description: string | null };

export type Review = {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string | null;
  author: string;
  verified: boolean;
  photos: string[];
  createdAt: string;
};

// ---------- Raw rows as the database returns them ----------
type RawProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price: number | string;
  compare_at_price: number | string | null;
  is_bundle: boolean;
  is_featured: boolean;
  track_stock: boolean;
  stock_quantity: number;
  created_at: string;
  category: { name: string; slug: string } | null;
  images: { url: string; alt: string | null; sort_order: number }[] | null;
  variants:
    | {
        id: string;
        name: string;
        options: Record<string, string> | null;
        price_override: number | string | null;
        stock_quantity: number;
        is_active: boolean;
        sort_order: number;
      }[]
    | null;
};

const PRODUCT_SELECT = `
  id, slug, name, description, base_price, compare_at_price, is_bundle, is_featured,
  track_stock, stock_quantity, created_at,
  category:categories ( name, slug ),
  images:product_images ( url, alt, sort_order ),
  variants:product_variants ( id, name, options, price_override, stock_quantity, is_active, sort_order )
`;

export function normalizeProduct(raw: RawProduct): Product {
  const base = Number(raw.base_price);

  const variants: Variant[] = (raw.variants ?? [])
    .filter((v) => v.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      id: v.id,
      name: v.name,
      options: v.options ?? {},
      price: v.price_override === null ? base : Number(v.price_override),
      stock: v.stock_quantity,
    }));

  const prices = variants.length ? variants.map((v) => v.price) : [base];

  let inStock: boolean;
  let stockLeft: number | null;
  if (variants.length) {
    stockLeft = variants.reduce((sum, v) => sum + v.stock, 0);
    inStock = stockLeft > 0;
  } else if (!raw.track_stock) {
    stockLeft = null;
    inStock = true;
  } else {
    stockLeft = raw.stock_quantity;
    inStock = raw.stock_quantity > 0;
  }

  const images = (raw.images ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({ url: i.url, alt: i.alt || raw.name }));

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    price: Math.min(...prices),
    maxPrice: Math.max(...prices),
    comparePrice: raw.compare_at_price === null ? null : Number(raw.compare_at_price),
    isBundle: raw.is_bundle,
    isFeatured: raw.is_featured,
    category: raw.category,
    images: images.length ? images : [{ url: "/placeholder.svg", alt: raw.name }],
    variants,
    inStock,
    stockLeft,
    createdAt: raw.created_at,
  };
}

// ---------- Fetchers (all return empty results instead of crashing) ----------
export async function getCatalog(): Promise<Product[]> {
  try {
    const db = createPublicClient();
    if (!db) return [];
    const { data, error } = await db
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[catalog] products:", error.message);
      return [];
    }
    return (data as unknown as RawProduct[]).map(normalizeProduct);
  } catch (e) {
    console.error("[catalog] products failed:", e);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await getCatalog();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getCategories(): Promise<Category[]> {
  try {
    const db = createPublicClient();
    if (!db) return [];
    const { data, error } = await db
      .from("categories")
      .select("id, name, slug, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[catalog] categories:", error.message);
      return [];
    }
    return data as Category[];
  } catch (e) {
    console.error("[catalog] categories failed:", e);
    return [];
  }
}

export async function getApprovedReviews(): Promise<Review[]> {
  try {
    const db = createPublicClient();
    if (!db) return [];
    const { data, error } = await db
      .from("reviews")
      .select("id, product_id, rating, title, body, photos, author_name, is_verified_purchase, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[catalog] reviews:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      productId: r.product_id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: r.author_name || "Customer",
      verified: r.is_verified_purchase,
      photos: Array.isArray(r.photos) ? (r.photos as string[]).filter((u) => /^https?:\/\//.test(u)).slice(0, 3) : [],
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.error("[catalog] reviews failed:", e);
    return [];
  }
}

export function reviewStats(reviews: Review[]) {
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, average };
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = createPublicClient();
    if (!db) return fallback;
    const { data, error } = await db.from("settings").select("value").eq("key", key).maybeSingle();
    if (error || !data) return fallback;
    return { ...fallback, ...(data.value as object) } as T;
  } catch {
    return fallback;
  }
}

export type StoreInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
  instagram: string;
};

export type ShippingSettings = {
  flat_rate: number;
  free_shipping_over: number | null;
};
