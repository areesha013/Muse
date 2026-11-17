import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { siteConfig } from "@/config/site";
import { getSetting, type StoreInfo } from "@/lib/catalog";

export const metadata: Metadata = { title: "Contact" };
export const revalidate = 60;

export default async function ContactPage() {
  const store = await getSetting<StoreInfo>("store", {
    name: siteConfig.name,
    email: "",
    phone: "",
    address: "",
    instagram: "",
  });

  return (
    <PageShell title="Contact us">
      <p>Questions about an order? The fastest way to reach us is WhatsApp. Have a custom idea? <Link href="/custom-order" className="text-accent-ink underline">Send us a custom request</Link>.</p>
      <a
        href={`https://wa.me/${siteConfig.whatsappNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700"
      >
        <MessageCircle size={18} aria-hidden /> Chat on WhatsApp
      </a>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        {store.email && (
          <div>
            <dt className="text-sm font-semibold text-neutral-900">Email</dt>
            <dd><a href={`mailto:${store.email}`} className="text-accent-ink underline">{store.email}</a></dd>
          </div>
        )}
        {store.phone && (
          <div>
            <dt className="text-sm font-semibold text-neutral-900">Phone</dt>
            <dd>{store.phone}</dd>
          </div>
        )}
        {store.address && (
          <div>
            <dt className="text-sm font-semibold text-neutral-900">Location</dt>
            <dd>{store.address}</dd>
          </div>
        )}
        {store.instagram && (
          <div>
            <dt className="text-sm font-semibold text-neutral-900">Instagram</dt>
            <dd><a href={store.instagram} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">{store.instagram}</a></dd>
          </div>
        )}
      </dl>
    </PageShell>
  );
}
