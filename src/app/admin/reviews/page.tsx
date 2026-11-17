import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/star-rating";
import { ReviewActions } from "@/components/admin/review-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

const PAGE_SIZE = 20;
const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Published" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
] as const;
type Status = "pending" | "approved" | "hidden";
type Row = {
  id: string; rating: number; title: string | null; body: string | null; photos: string[]; status: Status;
  is_verified_purchase: boolean; author_name: string | null; created_at: string;
  product: { name: string; slug: string } | null;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

export default async function ReviewsAdminPage({ searchParams }: { searchParams: { s?: string; page?: string } }) {
  const supabase = createClient();
  const tab = TABS.find((t) => t.key === searchParams.s)?.key ?? "pending";
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);

  let query = supabase
    .from("reviews")
    .select("id, rating, title, body, photos, status, is_verified_purchase, author_name, created_at, product:products(name, slug)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (tab !== "all") query = query.eq("status", tab);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const counts = await Promise.all(
    (["pending", "approved", "hidden"] as const).map(async (s) => {
      const { count: c } = await supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", s);
      return [s, c ?? 0] as const;
    })
  );
  const n = Object.fromEntries(counts) as Record<Status, number>;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const label = (t: (typeof TABS)[number]) => (t.key === "all" ? t.label : `${t.label} (${n[t.key]})`);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
      <p className="text-sm text-neutral-600">New reviews stay hidden until you approve them.</p>

      <div className="flex gap-2 overflow-x-auto pb-1" role="navigation" aria-label="Review filters">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/reviews?s=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", tab === t.key ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100")}>
            {label(t)}
          </Link>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Could not load reviews.</p>}
      {rows.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-600">
          {tab === "pending" ? "No reviews are waiting. Nice and tidy." : "Nothing here."}
        </p>
      )}

      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.id} className="space-y-3 rounded-2xl border border-neutral-200 p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <StarRating rating={r.rating} />
              {r.product ? <Link href={`/product/${r.product.slug}`} target="_blank" className="font-medium underline">{r.product.name}</Link> : <span className="text-neutral-600">Deleted product</span>}
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", r.status === "approved" ? "bg-green-100 text-green-900" : r.status === "hidden" ? "bg-neutral-200 text-neutral-800" : "bg-amber-100 text-amber-900")}>
                {r.status === "approved" ? "Published" : r.status === "hidden" ? "Hidden" : "Waiting"}
              </span>
            </div>
            {r.title && <p className="font-medium">{r.title}</p>}
            {r.body && <p className="whitespace-pre-line text-sm text-neutral-700">{r.body}</p>}
            {r.photos.length > 0 && (
              <ul className="flex gap-2">
                {r.photos.map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noopener noreferrer" aria-label="Open photo in a new tab">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="Photo from the customer" width={80} height={80} loading="lazy" className="h-20 w-20 rounded-lg object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-neutral-600">
              <span>{r.author_name ?? "Customer"}</span>
              <span>{dateFmt.format(new Date(r.created_at))}</span>
              {r.is_verified_purchase && <span className="inline-flex items-center gap-1 text-green-800"><BadgeCheck size={14} aria-hidden /> Verified purchase</span>}
            </p>
            <ReviewActions id={r.id} status={r.status} />
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/admin/reviews?s=${tab}&page=${page - 1}`} className="underline">Newer</Link> : <span />}
          <span className="text-neutral-600">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/admin/reviews?s=${tab}&page=${page + 1}`} className="underline">Older</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
