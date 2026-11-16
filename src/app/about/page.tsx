import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { aboutText } from "@/content/pages";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <PageShell title={`About ${siteConfig.name}`}>
      {aboutText.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </PageShell>
  );
}
