import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { PAYMENT_METHOD_LABEL, STATUS_LABEL, type OrderStatus, type PaymentMethod } from "@/lib/orders";
import { formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

type Row = {
  order_number: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total: number;
  created_at: string;
  access_token: string;
};

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");

  // Row Level Security: a customer can only ever read their own orders here.
  const { data } = await createClient()
    .from("orders")
    .select("order_number, status, payment_method, total, created_at, access_token")
    .order("created_at", { ascending: false })
    .limit(30);
  const orders = (data ?? []) as Row[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{viewer.fullName ? `Hi, ${viewer.fullName.split(" ")[0]}` : "My account"}</h1>
          <p className="mt-1 text-neutral-600">{viewer.email}</p>
        </div>
        <div className="flex gap-3">
          {viewer.role === "admin" && (
            <Link href="/admin" className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">
              Admin panel
            </Link>
          )}
          <form action={logout}>
            <button className="rounded-full border border-neutral-900 px-5 py-2.5 text-sm font-medium hover:bg-neutral-100">Log out</button>
          </form>
        </div>
      </div>

      <h2 className="mt-12 text-lg font-semibold">Your orders</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-neutral-600">
          No orders yet. <Link href="/shop" className="underline">Go to the shop</Link>. Orders placed while logged in show up here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {orders.map((o) => (
            <li key={o.order_number}>
              <Link href={`/order/${o.access_token}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-neutral-50">
                <span>
                  <span className="block font-medium">{o.order_number}</span>
                  <span className="block text-sm text-neutral-600">
                    {new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {PAYMENT_METHOD_LABEL[o.payment_method]}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-medium">{formatPKR(Number(o.total))}</span>
                  <span className="block text-sm text-neutral-600">{STATUS_LABEL[o.status]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
