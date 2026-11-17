"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbMessage, getAdminContext, NOT_ADMIN, type ActionResult } from "@/lib/admin";
import { sniffImageType, MAX_RECEIPT_BYTES } from "@/lib/orders";
import { SLUG_RE, slugify } from "@/lib/slug";

const BUCKET = "product-images";
const uuid = z.string().uuid();

// Public pages are cached for a minute. Clearing them makes changes show at once.
function refreshShop() {
  revalidatePath("/", "layout");
}

// ---------------- Products ----------------
const money = z.number().finite().min(0).max(10_000_000).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use at most 2 decimals.");

const productSchema = z
  .object({
    id: uuid.nullable(),
    name: z.string().trim().min(2, "Please enter a name.").max(120, "The name is too long."),
    slug: z.string().trim().toLowerCase().max(90).optional(),
    category_id: uuid.nullable(),
    description: z.string().trim().max(4000, "The description is too long (4000 characters max)."),
    base_price: money,
    compare_at_price: money.nullable(),
    is_bundle: z.boolean(),
    is_featured: z.boolean(),
    is_active: z.boolean(),
    track_stock: z.boolean(),
    stock_quantity: z.number().int("Stock must be a whole number.").min(0, "Stock cannot be below zero.").max(100_000),
  })
  .refine((v) => v.compare_at_price === null || v.compare_at_price > v.base_price, {
    message: "The old price must be higher than the price (it is shown crossed out).",
    path: ["compare_at_price"],
  });

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  const slug = v.slug ? v.slug : slugify(v.name);
  if (!SLUG_RE.test(slug)) return { ok: false, message: "The web address can only use lowercase letters, numbers and dashes." };

  const row = {
    name: v.name,
    slug,
    category_id: v.category_id,
    description: v.description || null,
    base_price: v.base_price,
    compare_at_price: v.compare_at_price,
    is_bundle: v.is_bundle,
    is_featured: v.is_featured,
    is_active: v.is_active,
    track_stock: v.track_stock,
    stock_quantity: v.stock_quantity,
  };

  if (v.id) {
    const { error } = await ctx.supabase.from("products").update(row).eq("id", v.id);
    if (error) return { ok: false, message: dbMessage(error) };
    refreshShop();
    return { ok: true, id: v.id, message: "Saved." };
  }
  const { data, error } = await ctx.supabase.from("products").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: dbMessage(error) };
  refreshShop();
  return { ok: true, id: data.id as string, message: "Product created. Now add photos and options." };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(productId);
  if (!id.success) return { ok: false, message: "That request was not valid." };

  // Remove the uploaded photos from storage first (rows go away with the product).
  const { data: imgs } = await ctx.supabase.from("product_images").select("url").eq("product_id", id.data);
  const paths = (imgs ?? []).map((i) => storagePathFromUrl(i.url as string)).filter((p): p is string => !!p);
  if (paths.length) await ctx.supabase.storage.from(BUCKET).remove(paths);

  const { error } = await ctx.supabase.from("products").delete().eq("id", id.data);
  if (error) return { ok: false, message: dbMessage(error) };
  refreshShop();
  return { ok: true, message: "Product deleted." };
}

// ---------------- Photos ----------------
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export async function uploadProductImage(formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const productId = uuid.safeParse(formData.get("product_id"));
  const file = formData.get("file");
  if (!productId.success || !(file instanceof File)) return { ok: false, message: "Please choose a photo." };
  if (file.size === 0) return { ok: false, message: "That file is empty." };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, message: "That photo is bigger than 5 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes); // checks the file's real content, not its name
  if (!type) return { ok: false, message: "Please upload a JPG, PNG or WebP photo." };

  const { data: product } = await ctx.supabase.from("products").select("id, name").eq("id", productId.data).maybeSingle();
  if (!product) return { ok: false, message: "Product not found." };

  const ext = type === "jpeg" ? "jpg" : type;
  const path = `${productId.data}/${randomUUID()}.${ext}`;
  const { error: upError } = await ctx.supabase.storage.from(BUCKET).upload(path, bytes, { contentType: `image/${type}`, upsert: false });
  if (upError) return { ok: false, message: dbMessage(upError, "The photo could not be uploaded. Please try again.") };

  const { data: pub } = ctx.supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: existing } = await ctx.supabase.from("product_images").select("id, url, sort_order").eq("product_id", productId.data);
  const rows = existing ?? [];
  const real = rows.filter((r) => !(r.url as string).startsWith("/"));
  const nextOrder = real.length ? Math.max(...real.map((r) => Number(r.sort_order))) + 1 : 0;

  const { error } = await ctx.supabase
    .from("product_images")
    .insert({ product_id: productId.data, url: pub.publicUrl, alt: product.name as string, sort_order: nextOrder });
  if (error) {
    await ctx.supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, message: dbMessage(error) };
  }
  // The first real photo replaces the placeholder picture.
  const placeholders = rows.filter((r) => (r.url as string).startsWith("/")).map((r) => r.id as string);
  if (placeholders.length) await ctx.supabase.from("product_images").delete().in("id", placeholders);

  refreshShop();
  return { ok: true, message: "Photo added." };
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(imageId);
  if (!id.success) return { ok: false, message: "That request was not valid." };
  const { data: img } = await ctx.supabase.from("product_images").select("url").eq("id", id.data).maybeSingle();
  if (!img) return { ok: false, message: "Photo not found." };
  const { error } = await ctx.supabase.from("product_images").delete().eq("id", id.data);
  if (error) return { ok: false, message: dbMessage(error) };
  const path = storagePathFromUrl(img.url as string);
  if (path) await ctx.supabase.storage.from(BUCKET).remove([path]);
  refreshShop();
  return { ok: true, message: "Photo removed." };
}

export async function makeMainImage(imageId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(imageId);
  if (!id.success) return { ok: false, message: "That request was not valid." };
  const { data: img } = await ctx.supabase.from("product_images").select("product_id").eq("id", id.data).maybeSingle();
  if (!img) return { ok: false, message: "Photo not found." };
  const { data: all } = await ctx.supabase.from("product_images").select("sort_order").eq("product_id", img.product_id);
  const min = Math.min(0, ...(all ?? []).map((r) => Number(r.sort_order)));
  const { error } = await ctx.supabase.from("product_images").update({ sort_order: min - 1 }).eq("id", id.data);
  if (error) return { ok: false, message: dbMessage(error) };
  refreshShop();
  return { ok: true, message: "This is now the main photo." };
}

// ---------------- Variants (options such as color or size) ----------------
const variantSchema = z.object({
  id: uuid.nullable(),
  product_id: uuid,
  name: z.string().trim().min(1, "Give the option a name, like Pink or Large.").max(80),
  sku: z.string().trim().max(40).nullable(),
  price_override: money.nullable(),
  stock_quantity: z.number().int("Stock must be a whole number.").min(0, "Stock cannot be below zero.").max(100_000),
  is_active: z.boolean(),
});
export type VariantInput = z.input<typeof variantSchema>;

export async function saveVariant(input: VariantInput): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  const row = {
    product_id: v.product_id,
    name: v.name,
    sku: v.sku || null,
    price_override: v.price_override,
    stock_quantity: v.stock_quantity,
    is_active: v.is_active,
  };
  if (v.id) {
    const { error } = await ctx.supabase.from("product_variants").update(row).eq("id", v.id);
    if (error) return { ok: false, message: dbMessage(error) };
  } else {
    const { data: siblings } = await ctx.supabase.from("product_variants").select("sort_order").eq("product_id", v.product_id);
    const order = Math.max(0, ...(siblings ?? []).map((s) => Number(s.sort_order))) + 1;
    const { error } = await ctx.supabase.from("product_variants").insert({ ...row, sort_order: order });
    if (error) return { ok: false, message: dbMessage(error) };
  }
  refreshShop();
  return { ok: true, message: "Saved." };
}

export async function deleteVariant(variantId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(variantId);
  if (!id.success) return { ok: false, message: "That request was not valid." };
  const { error } = await ctx.supabase.from("product_variants").delete().eq("id", id.data);
  if (error) return { ok: false, message: dbMessage(error) };
  refreshShop();
  return { ok: true, message: "Option deleted." };
}

// ---------------- Categories ----------------
const categorySchema = z.object({
  id: uuid.nullable(),
  name: z.string().trim().min(2, "Please enter a name.").max(60),
  slug: z.string().trim().toLowerCase().max(70).optional(),
  description: z.string().trim().max(300),
  sort_order: z.number().int().min(0).max(1000),
  is_active: z.boolean(),
});
export type CategoryInput = z.input<typeof categorySchema>;

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  const slug = v.slug ? v.slug : slugify(v.name);
  if (!SLUG_RE.test(slug)) return { ok: false, message: "The web address can only use lowercase letters, numbers and dashes." };
  const row = { name: v.name, slug, description: v.description || null, sort_order: v.sort_order, is_active: v.is_active };
  const { error } = v.id ? await ctx.supabase.from("categories").update(row).eq("id", v.id) : await ctx.supabase.from("categories").insert(row);
  if (error) return { ok: false, message: dbMessage(error) };
  refreshShop();
  return { ok: true, message: "Saved." };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(categoryId);
  if (!id.success) return { ok: false, message: "That request was not valid." };
  const { error } = await ctx.supabase.from("categories").delete().eq("id", id.data);
  if (error) return { ok: false, message: dbMessage(error) };
  refreshShop();
  return { ok: true, message: "Category deleted. Its products are kept, just without a category." };
}
