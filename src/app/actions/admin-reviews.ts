"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbMessage, getAdminContext, NOT_ADMIN, type ActionResult } from "@/lib/admin";
import { pathInBucket } from "@/lib/storage-path";

const uuid = z.string().uuid();
const refresh = () => revalidatePath("/", "layout");

export async function setReviewStatus(reviewId: string, status: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(reviewId);
  const st = z.enum(["approved", "hidden", "pending"]).safeParse(status);
  if (!id.success || !st.success) return { ok: false, message: "That request was not valid." };
  const { data, error } = await ctx.supabase.from("reviews").update({ status: st.data }).eq("id", id.data).select("id");
  if (error) return { ok: false, message: dbMessage(error) };
  if (!data?.length) return { ok: false, message: "Review not found." };
  refresh();
  return { ok: true, message: st.data === "approved" ? "Published on the shop." : st.data === "hidden" ? "Hidden from the shop." : "Moved back to waiting." };
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(reviewId);
  if (!id.success) return { ok: false, message: "That request was not valid." };
  const { data: row } = await ctx.supabase.from("reviews").select("photos").eq("id", id.data).maybeSingle();
  const { error } = await ctx.supabase.from("reviews").delete().eq("id", id.data);
  if (error) return { ok: false, message: dbMessage(error) };
  const paths = ((row?.photos as string[] | null) ?? []).map((u) => pathInBucket(u, "review-photos")).filter((p): p is string => !!p);
  if (paths.length) await ctx.supabase.storage.from("review-photos").remove(paths);
  refresh();
  return { ok: true, message: "Review deleted." };
}
