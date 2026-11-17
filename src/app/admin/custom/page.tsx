import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CUSTOM_STATUSES, CUSTOM_STATUS_LABEL, type CustomStatus } from "@/lib/custom-order";
import { formatPKR, cn } from "@/lib/utils";
import { CustomStatusBadge } from "@/components/admin/status-badge";

export const metadata: Metadata = { title: "Custom orders" };

const PAGE_SIZE = 20;
type Row = { id: string; name: string; phone: string; product_type: string; budget: number | null; deadline: string | null; status: CustomStatus; quote_amount: number | null; created_at: string; reference_images: string[] };
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

export default async function CustomListPage({ searchParams }: { searchParams: { s?: string; page?: string } }) {
  const supabase = createClient();
  const status = CUSTOM_STATUSES.includes(searchParams.s as CustomStatus) ? (searchParams.s as CustomStatus) : null;
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);

  let query = supabase
    .from("custom_requests")
    .select("id, name, phone, product_type, budget, deadline, status, quote_amount, created_at, reference_images", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query;
  const rows = (data ?? []) as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const counts = await Promise.all(
    CUSTOM_STATUSES.map(async (s) => {
      const { count: c } = await supabase.from("custom_requests").select("id", { count: "exact", head: true }).eq("status", s);
      return [s, c ?? 0] as const;
    })
  );
  const n = Object.fromEntries(counts) as Record<CustomStatus, number>;
  const all = counts.reduce((a, [, c]) => a + c, 0);

  const tab = (label: string, active: boolean, to: string) => (
    <Link key={label} href={to} aria-current={active ? "page" : undefined}
      className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100")}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Custom orders</h1>
      <p className="text-sm text-neutral-600">Requests from the Custom orders page. Open one to send a price and reply.</p>

      <div className="flex gap-2 overflow-x-auto pb-1" role="navigation" aria-label="Request filters">
        {tab(`All (${all})`, !status, "/admin/custom")}
        {CUSTOM_STATUSES.map((s) => tab(`${CUSTOM_STATUS_LABEL[s]} (${n[s]})`, status === s, `/admin/custom?s=${s}`))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Could not load requests.</p>}
      {rows.length === 0 && !error && <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-600">No requests here.</p>}

      <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/custom/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-neutral-50">
              <span className="min-w-0">
                <span className="block font-medium">{r.name} <span className="font-normal text-neutral-600">· {r.product_type}</span></span>
                <span className="block text-sm text-neutral-600">
                  {dateFmt.format(new Date(r.created_at))} · {r.phone}
                  {r.reference_images.length > 0 && ` · ${r.reference_images.length} ${r.reference_images.length === 1 ? "picture" : "pictures"}`}
                  {r.deadline && ` · needed by ${dateFmt.format(new Date(r.deadline))}`}
                </span>
              </span>
              <span className="flex items-center gap-3 text-right text-sm">
                {r.quote_amount !== null ? <span className="font-medium">{formatPKR(Number(r.quote_amount))}</span> : r.budget !== null ? <span className="text-neutral-600">Budget {formatPKR(Number(r.budget))}</span> : null}
                <CustomStatusBadge status={r.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/admin/custom?${status ? `s=${status}&` : ""}page=${page - 1}`} className="underline">Newer</Link> : <span />}
          <span className="text-neutral-600">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/admin/custom?${status ? `s=${status}&` : ""}page=${page + 1}`} className="underline">Older</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
