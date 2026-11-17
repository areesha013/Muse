import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { siteConfig } from "@/config/site";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { logout } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s | Admin | ${siteConfig.name}` },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin("/admin");

  if (!viewer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">No admin access</h1>
        <p className="mt-3 text-neutral-600">You are logged in, but this account is not an admin. If this is your shop, see the README step &quot;Make yourself the first admin&quot;.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">Back to shop</Link>
          <form action={logout}>
            <button className="rounded-full border border-neutral-900 px-6 py-2.5 text-sm font-medium hover:bg-neutral-100">Log out</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="text-lg font-semibold tracking-[0.3em]">{siteConfig.name}</Link>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-ink">Admin</span>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/" target="_blank" className="hidden items-center gap-1 text-neutral-700 hover:underline sm:flex">
              View shop <ExternalLink size={14} aria-hidden />
            </Link>
            <form action={logout}>
              <button className="rounded-full border border-neutral-300 px-4 py-1.5 font-medium hover:bg-neutral-100">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0">
          <AdminNav />
        </aside>
        <main id="main" className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
