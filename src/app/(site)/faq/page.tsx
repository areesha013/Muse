import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { faqs } from "@/content/pages";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <PageShell title="Frequently asked questions">
      <div className="divide-y divide-neutral-200 border-y border-neutral-200">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="cursor-pointer list-none font-medium text-neutral-900 marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {f.q}
                <span aria-hidden className="text-xl leading-none transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 text-neutral-700">{f.a}</p>
          </details>
        ))}
      </div>
    </PageShell>
  );
}
