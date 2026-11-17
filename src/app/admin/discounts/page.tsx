import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DiscountManager, type Disc } from "@/components/admin/discount-manager";

export const metadata: Metadata = { title: "Discount codes" };

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }); // yyyy-mm-dd

export default async function DiscountsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("id, code, type, value, min_order, max_uses, times_used, expires_at, is_active")
    .order("created_at", { ascending: false });

  const now = Date.now();
  const discounts: Disc[] = (data ?? []).map((d) => ({
    id: d.id as string,
    code: d.code as string,
    type: d.type as Disc["type"],
    value: String(Number(d.value)),
    min_order: Number(d.min_order) > 0 ? String(Number(d.min_order)) : "",
    max_uses: d.max_uses ? String(d.max_uses) : "",
    expires_on: d.expires_at ? dayFmt.format(new Date(d.expires_at as string)) : "",
    is_active: Boolean(d.is_active),
    times_used: Number(d.times_used),
    expired: d.expires_at ? new Date(d.expires_at as string).getTime() < now : false,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Discount codes</h1>
      <p className="text-sm text-neutral-600">Customers type the code at checkout. Codes work only once the order total reaches the minimum.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Could not load codes.</p>}
      <DiscountManager discounts={discounts} />
    </div>
  );
}
