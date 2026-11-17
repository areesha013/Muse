import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD_LABEL, STATUS_LABEL, type OrderStatus, type PaymentMethod, type PaymentStatus } from "@/lib/orders";
import { formatPKR, cn } from "@/lib/utils";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badge";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 20;
const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];

type Row = {
  id: string; order_number: string; customer_name: string; customer_phone: string; shipping_city: string;
  total: number; status: OrderStatus; payment_method: PaymentMethod; created_at: string;
};

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string; q?: string; page?: string; review?: string } }) {
  const supabase = createClient();
  const status = STATUSES.includes(searchParams.status as OrderStatus) ? (searchParams.status as OrderStatus) : null;
  const review = searchParams.review === "1";
  const q = (searchParams.q ?? "").replace(/[^a-zA-Z0-9 +.@-]/g, "").trim().slice(0, 40);
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);

  let reviewIds: string[] | null = null;
  if (review) {
    const { data } = await supabase.from("payments").select("order_id").eq("status", "submitted").limit(200);
    reviewIds = (data ?? []).map((p) => p.order_id as string);
  }

  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, shipping_city, total, status, payment_method, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (reviewIds) query = query.in("id", reviewIds.length ? reviewIds : ["00000000-0000-0000-0000-000000000000"]);
  if (q) query = query.or(`order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);

  const { data, count, error } = await query;
  const orders = (data ?? []) as Row[];

  const payStatus = new Map<string, PaymentStatus>();
  if (orders.length) {
    const { data: pays } = await supabase.from("payments").select("order_id, status").in("order_id", orders.map((o) => o.id));
    for (const p of pays ?? []) payStatus.set(p.order_id as string, p.status as PaymentStatus);
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { status, review: review ? "1" : null, q: q || null, page: null, ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  const tab = (label: string, active: boolean, to: string) => (
    <Link key={label} href={to} aria-current={active ? "page" : undefined}
      className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100")}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      <div className="flex gap-2 overflow-x-auto pb-1" role="navigation" aria-label="Order filters">
        {tab("All", !status && !review, href({ status: null, review: null }))}
        {tab("Check payment", review, href({ status: null, review: "1" }))}
        {STATUSES.map((s) => tab(STATUS_LABEL[s], status === s, href({ status: s, review: null })))}
      </div>

      <form action="/admin/orders" role="search" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        {review && <input type="hidden" name="review" value="1" />}
        <label htmlFor="order-search" className="sr-only">Search orders</label>
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input id="order-search" name="q" defaultValue={q} placeholder="Order number, name or phone" className="h-10 w-full rounded-full border border-neutral-300 pl-9 pr-4 text-sm placeholder:text-neutral-500" />
        </div>
        <button className="h-10 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-700">Search</button>
      </form>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Could not load orders. Try again.</p>}

      {orders.length === 0 && !error ? (
        <p className="rounded-2xl bg-cream px-6 py-12 text-center text-neutral-600">No orders match.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {orders.map((o) => {
            const ps = payStatus.get(o.id);
            return (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 hover:bg-neutral-50 sm:grid-cols-[110px_1fr_150px_100px_auto] sm:items-center">
                  <span className="font-medium">{o.order_number}</span>
                  <span className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
                    <span className="block truncate">{o.customer_name}</span>
                    <span className="block truncate text-sm text-neutral-600">{o.shipping_city} · {o.customer_phone}</span>
                  </span>
                  <span className="hidden text-sm text-neutral-600 sm:block">{PAYMENT_METHOD_LABEL[o.payment_method]}</span>
                  <span className="text-right text-sm font-medium sm:text-left">{formatPKR(Number(o.total))}</span>
                  <span className="order-4 col-span-2 flex flex-wrap items-center gap-2 sm:order-none sm:col-span-1 sm:justify-end">
                    <OrderStatusBadge status={o.status} />
                    {o.payment_method !== "cod" && ps && o.status !== "cancelled" && ps !== "pending" && <PaymentStatusBadge status={ps} />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="underline">Previous</Link> : <span />}
          <span className="text-neutral-600">Page {page} of {pages} · {total} orders</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="underline">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
