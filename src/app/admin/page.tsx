import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/utils";
import type { OrderStatus } from "@/lib/orders";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import { SalesChart, type DayPoint } from "@/components/admin/sales-chart";

type Stats = {
  orders_by_status: Partial<Record<OrderStatus, number>>;
  new_today: number;
  payments_to_review: number;
  sales_today: number;
  sales_30d: number;
  orders_30d: number;
  reviews_pending: number;
  custom_requests_new: number;
  subscribers: number;
  low_stock: { product_id: string; name: string; variant: string | null; stock: number }[];
  recent_orders: { id: string; order_number: string; customer_name: string; total: number; status: OrderStatus; created_at: string }[];
  daily: DayPoint[];
};

function Card({ label, value, href, hint, attention }: { label: string; value: string; href?: string; hint?: string; attention?: boolean }) {
  const body = (
    <div className={`h-full rounded-2xl border p-5 ${attention ? "border-neutral-900 bg-accent-soft" : "border-neutral-200"}`}>
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

export default async function AdminDashboard() {
  const { data, error } = await createClient().rpc("admin_dashboard_stats");
  if (error || !data) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load the numbers. Did you run <code>0006_admin.sql</code> in Supabase? ({error?.message ?? "no data"})
        </p>
      </div>
    );
  }
  const s = data as Stats;
  const toReview = Number(s.payments_to_review);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Payments to check" value={String(toReview)} href="/admin/orders?review=1" attention={toReview > 0} hint={toReview > 0 ? "Customers are waiting" : "All caught up"} />
        <Card label="New orders today" value={String(s.new_today)} href="/admin/orders" />
        <Card label="Sales today" value={formatPKR(Number(s.sales_today))} hint="Paid or confirmed" />
        <Card label="Sales, last 30 days" value={formatPKR(Number(s.sales_30d))} hint={`${s.orders_30d} orders`} />
      </div>

      <section aria-labelledby="chart-h" className="rounded-2xl border border-neutral-200 p-5">
        <h2 id="chart-h" className="font-semibold">Sales per day, last 14 days (Rs)</h2>
        <div className="mt-4">
          <SalesChart days={s.daily} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recent-h" className="rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <h2 id="recent-h" className="font-semibold">Latest orders</h2>
            <Link href="/admin/orders" className="text-sm underline">See all</Link>
          </div>
          {s.recent_orders.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {s.recent_orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-neutral-50">
                    <span className="min-w-0">
                      <span className="block font-medium">{o.order_number}</span>
                      <span className="block truncate text-sm text-neutral-600">{o.customer_name}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium">{formatPKR(Number(o.total))}</span>
                      <OrderStatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="stock-h" className="rounded-2xl border border-neutral-200 p-5">
            <h2 id="stock-h" className="font-semibold">Running low (3 or fewer)</h2>
            {s.low_stock.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-600">Nothing is running low.</p>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100">
                {s.low_stock.map((x, i) => (
                  <li key={`${x.product_id}-${i}`}>
                    <Link href={`/admin/products/${x.product_id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-neutral-50">
                      <span>{x.name}{x.variant ? `, ${x.variant}` : ""}</span>
                      <span className={x.stock === 0 ? "font-medium text-red-700" : "font-medium"}>{x.stock === 0 ? "Sold out" : `${x.stock} left`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="more-h" className="rounded-2xl border border-neutral-200 p-5">
            <h2 id="more-h" className="font-semibold">Also</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-600">Reviews waiting for approval</dt><dd className="font-medium">{s.reviews_pending}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-600">New custom order requests</dt><dd className="font-medium">{s.custom_requests_new}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-600">Newsletter subscribers</dt><dd className="font-medium">{s.subscribers}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
