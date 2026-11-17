import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; notice?: string } }) {
  const next = safeNext(searchParams.next, "");
  const viewer = await getViewer();
  if (viewer) redirect(next || (viewer.role === "admin" ? "/admin" : "/account"));

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>
      {searchParams.notice === "confirm" && (
        <p role="status" className="mt-4 rounded-xl bg-cream px-4 py-3 text-sm">
          Almost done. We emailed you a link. Click it to confirm your email, then log in here.
        </p>
      )}
      <div className="mt-8">
        <AuthForm mode="login" next={next || undefined} />
      </div>
    </div>
  );
}
