import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { toWhatsAppNumber } from "@/lib/phone";
import { formatPKR } from "@/lib/utils";
import { CustomStatusBadge } from "@/components/admin/status-badge";
import { CustomRequestForm } from "@/components/admin/custom-request-form";
import type { CustomStatus } from "@/lib/custom-order";

export const metadata: Metadata = { title: "Custom request" };
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function CustomDetailPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const { data: r } = await supabase.from("custom_requests").select("*").eq("id", params.id).maybeSingle();
  if (!r) notFound();

  // Reference pictures are private. Short-lived links (5 minutes) are made for the admin only.
  const paths = (r.reference_images as string[]) ?? [];
  const urls = paths.length ? ((await supabase.storage.from("custom-requests").createSignedUrls(paths, 300)).data ?? []).map((x) => x.signedUrl).filter((u): u is string => !!u) : [];

  const wa = toWhatsAppNumber(r.phone as string);
  const first = (r.name as string).split(" ")[0];
  const waBase = `https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${first}, this is MUSE about your custom request (${r.product_type}).\n`)}`.replace(/%0A$/, "%0A");

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-1.5 text-sm">
      <dt className="text-neutral-600">{k}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{v}</dd>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/custom" className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:underline"><ArrowLeft size={14} aria-hidden /> All requests</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{r.product_type}</h1>
        <CustomStatusBadge status={r.status as CustomStatus} />
        <span className="text-sm text-neutral-600">{dateTime.format(new Date(r.created_at as string))}</span>
      </div>

      <section aria-labelledby="who-h" className="rounded-2xl border border-neutral-200 p-5">
        <h2 id="who-h" className="font-semibold">Customer</h2>
        <dl className="mt-2 divide-y divide-neutral-100">
          <Row k="Name" v={r.name as string} />
          <Row k="Phone" v={r.phone as string} />
          {r.email && <Row k="Email" v={r.email as string} />}
          <Row k="Has an account" v={r.user_id ? "Yes (sees your reply in My account)" : "No (guest)"} />
          {r.budget !== null && <Row k="Budget" v={formatPKR(Number(r.budget))} />}
          {r.deadline && <Row k="Needed by" v={day.format(new Date(r.deadline as string))} />}
        </dl>
      </section>

      <section aria-labelledby="idea-h" className="rounded-2xl border border-neutral-200 p-5">
        <h2 id="idea-h" className="font-semibold">Their idea</h2>
        <p className="mt-2 whitespace-pre-line break-words text-sm text-neutral-800">{r.description as string}</p>
        {urls.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {urls.map((u, i) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Reference picture ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-xl border border-neutral-200 object-cover" />
                </a>
              </li>
            ))}
          </ul>
        )}
        {urls.length > 0 && <p className="mt-2 text-xs text-neutral-600">Picture links work for 5 minutes. Reload the page for fresh ones.</p>}
      </section>

      <CustomRequestForm
        id={r.id as string}
        status={r.status as CustomStatus}
        quote={r.quote_amount !== null ? String(Number(r.quote_amount)) : ""}
        reply={(r.admin_reply as string | null) ?? ""}
        hasEmail={!!r.email}
        whatsappHref={waBase}
      />
    </div>
  );
}
