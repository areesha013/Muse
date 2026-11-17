"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { sniffImageType, MAX_RECEIPT_BYTES } from "@/lib/orders";
import { dbMessage } from "@/lib/admin";
import { notifyOwner } from "@/lib/email";
import { pathInBucket } from "@/lib/storage-path";

const pathFromUrl = (url: string) => pathInBucket(url, "review-photos");

const BUCKET = "review-photos";
const uuid = z.string().uuid();

export type PhotoResult = { ok: true; url: string } | { ok: false; message: string };
export type SimpleResult = { ok: true; message?: string } | { ok: false; message: string };
export type SubmitResult = { ok: true; message: string; id: string } | { ok: false; message: string };

const NEED_LOGIN = "Please log in to write a review.";

// One photo per call. Files go into a folder named after the logged-in customer,
// and the storage rules only allow exactly that.
export async function uploadReviewPhoto(formData: FormData): Promise<PhotoResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: NEED_LOGIN };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Please choose a photo." };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, message: "That photo is bigger than 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, message: "Please upload a JPG, PNG or WebP photo." };

  const supabase = createClient();
  const path = `${viewer.id}/${randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: `image/${type}`, upsert: false });
  if (error) return { ok: false, message: dbMessage(error, "The photo could not be uploaded. Please try again.") };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

// Remove a photo the customer added but then took off the form.
export async function deleteReviewPhoto(url: string): Promise<SimpleResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: NEED_LOGIN };
  const path = pathFromUrl(url);
  if (!path || !path.startsWith(`${viewer.id}/`)) return { ok: false, message: "That photo is not yours." };
  await createClient().storage.from(BUCKET).remove([path]);
  return { ok: true };
}

const reviewSchema = z.object({
  productId: uuid,
  rating: z.number().int().min(1, "Please choose a star rating.").max(5),
  title: z.string().trim().max(100, "The title is too long (100 letters at most).").optional(),
  body: z.string().trim().max(1500, "The review is too long (1500 letters at most).").optional(),
  photos: z.array(z.string().url().max(500)).max(3, "You can add up to 3 photos."),
});

export async function submitReview(input: z.input<typeof reviewSchema>): Promise<SubmitResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: NEED_LOGIN };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your review." };
  const d = parsed.data;
  if (!d.body && !d.title) return { ok: false, message: "Please write a few words about the product." };

  const supabase = createClient();
  const { data: created, error } = await supabase
    .from("reviews")
    .insert({
      product_id: d.productId,
      user_id: viewer.id,
      rating: d.rating,
      title: d.title || null,
      body: d.body || null,
      photos: d.photos,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.toLowerCase().includes("duplicate key")) return { ok: false, message: "You already reviewed this product." };
    return { ok: false, message: dbMessage(error, "Your review could not be saved. Please try again.") };
  }
  await notifyOwner("New review waiting for approval", `${viewer.fullName ?? "A customer"} left a ${d.rating}-star review.\n\n${d.title ?? ""}\n${d.body ?? ""}\n\nApprove or hide it in Admin > Reviews.`);
  return { ok: true, message: "Thank you! Your review will appear once we have checked it.", id: created.id as string };
}

export async function deleteMyReview(reviewId: string): Promise<SimpleResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: NEED_LOGIN };
  if (!uuid.safeParse(reviewId).success) return { ok: false, message: "That request was not valid. Please reload the page." };
  const supabase = createClient();
  const { data: row } = await supabase.from("reviews").select("photos").eq("id", reviewId).eq("user_id", viewer.id).maybeSingle();
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", viewer.id);
  if (error) return { ok: false, message: dbMessage(error) };
  const paths = ((row?.photos as string[] | null) ?? []).map(pathFromUrl).filter((p): p is string => !!p && p.startsWith(`${viewer.id}/`));
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  return { ok: true };
}
