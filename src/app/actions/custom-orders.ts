"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { normalizePkPhone } from "@/lib/phone";
import { parseMoney } from "@/lib/slug";
import { sniffImageType, MAX_RECEIPT_BYTES } from "@/lib/orders";
import { CUSTOM_TYPES, MAX_REFERENCE_IMAGES, todayInPakistan } from "@/lib/custom-order";
import { isEmail, notifyOwner, sendEmail, siteUrl } from "@/lib/email";
import { siteConfig } from "@/config/site";

export type CustomResult = { ok: true } | { ok: false; message: string; field?: string };

const BUCKET = "custom-requests";
const PER_PHONE_PER_DAY = 3;
const ALL_PER_HOUR = 40;

const field = (name: string, max: number) => z.string().trim().max(max, `${name} is too long.`);

export async function submitCustomRequest(formData: FormData): Promise<CustomResult> {
  // Spam bots fill the hidden field. Pretend it worked, save nothing.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: "Requests aren't available right now. Please message us on WhatsApp." };
  }

  const get = (k: string) => String(formData.get(k) ?? "");
  const name = field("The name", 100).min(1, "Please enter your name.").safeParse(get("name"));
  if (!name.success) return { ok: false, message: name.error.issues[0].message, field: "name" };

  const phone = normalizePkPhone(get("phone"));
  if (!phone) return { ok: false, message: "Please enter a Pakistani mobile number, like 0300 1234567.", field: "phone" };

  const emailRaw = get("email").trim();
  if (emailRaw && !isEmail(emailRaw)) return { ok: false, message: "That email address does not look right.", field: "email" };

  const type = z.enum(CUSTOM_TYPES).safeParse(get("product_type"));
  if (!type.success) return { ok: false, message: "Please choose what you would like made.", field: "product_type" };

  const desc = field("The description", 2000).min(10, "Please tell us a little more (at least a sentence).").safeParse(get("description"));
  if (!desc.success) return { ok: false, message: desc.error.issues[0].message, field: "description" };

  let budget: number | null = null;
  if (get("budget").trim()) {
    budget = parseMoney(get("budget"));
    if (budget === null || budget > 10_000_000) return { ok: false, message: "Budget should be a number, like 2500.", field: "budget" };
  }

  let deadline: string | null = null;
  if (get("deadline").trim()) {
    const d = get("deadline").trim();
    const today = todayInPakistan();
    const max = todayInPakistan(new Date(Date.now() + 366 * 86_400_000));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return { ok: false, message: "Please pick a valid date.", field: "deadline" };
    if (d < today) return { ok: false, message: "That date has already passed.", field: "deadline" };
    if (d > max) return { ok: false, message: "Please pick a date within the next year.", field: "deadline" };
    deadline = d;
  }

  // Reference pictures (optional, up to 3)
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_REFERENCE_IMAGES) return { ok: false, message: `You can add up to ${MAX_REFERENCE_IMAGES} pictures.`, field: "images" };
  const prepared: { bytes: Uint8Array; ext: string; type: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_RECEIPT_BYTES) return { ok: false, message: "One of the pictures is bigger than 5 MB.", field: "images" };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const t = sniffImageType(bytes); // the file's real content, not its name
    if (!t) return { ok: false, message: "Pictures must be JPG, PNG or WebP.", field: "images" };
    prepared.push({ bytes, ext: t === "jpeg" ? "jpg" : t, type: `image/${t}` });
  }

  const db = createAdminClient();

  // Gentle limits so the inbox cannot be flooded.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [{ count: byPhone }, { count: overall }] = await Promise.all([
    db.from("custom_requests").select("id", { count: "exact", head: true }).eq("phone", phone).gte("created_at", dayAgo),
    db.from("custom_requests").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
  ]);
  if ((byPhone ?? 0) >= PER_PHONE_PER_DAY) {
    return { ok: false, message: "You have already sent a few requests today. We will reply soon, or message us on WhatsApp." };
  }
  if ((overall ?? 0) >= ALL_PER_HOUR) return { ok: false, message: "We are getting a lot of requests right now. Please try again in a little while." };

  const viewer = await getViewer();
  const id = randomUUID();
  const paths: string[] = [];
  for (const p of prepared) {
    const path = `${id}/${randomUUID()}.${p.ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, p.bytes, { contentType: p.type, upsert: false });
    if (error) {
      console.error("[custom] upload:", error.message);
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      return { ok: false, message: "The pictures could not be uploaded. Please try again, or send without pictures." };
    }
    paths.push(path);
  }

  const { error } = await db.from("custom_requests").insert({
    id,
    user_id: viewer?.id ?? null,
    name: name.data,
    email: emailRaw || null,
    phone,
    product_type: type.data,
    description: desc.data,
    budget,
    deadline,
    reference_images: paths,
  });
  if (error) {
    console.error("[custom] insert:", error.message);
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  await notifyOwner(
    `New custom request: ${type.data}`,
    `${name.data} (${phone}) asked for: ${type.data}\n\n${desc.data}\n\nBudget: ${budget ?? "not given"}\nNeeded by: ${deadline ?? "no date"}\nPictures: ${paths.length}\n\nOpen it in Admin > Custom orders:\n${siteUrl()}/admin/custom/${id}`
  );
  if (isEmail(emailRaw)) {
    await sendEmail({
      to: emailRaw,
      subject: `We got your custom request (${siteConfig.name})`,
      text: `Hi ${name.data.split(" ")[0]},\n\nThank you for your custom request for: ${type.data}.\nWe will look at it and reply with a price and timing, usually within 2 days.\n\nIf it is urgent, message us on WhatsApp: https://wa.me/${siteConfig.whatsappNumber}`,
    });
  }
  return { ok: true };
}
