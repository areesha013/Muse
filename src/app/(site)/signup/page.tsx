import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next, "");
  const viewer = await getViewer();
  if (viewer) redirect(next || "/account");

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-2 text-neutral-600">An account lets you see your orders in one place. You can still order without one.</p>
      <div className="mt-8">
        <AuthForm mode="signup" next={next || undefined} />
      </div>
    </div>
  );
}
