import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/password-forms";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  // The emailed link logs the person in first (see /auth/callback). No login = no link used.
  const viewer = await getViewer();
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
      {viewer ? (
        <div className="mt-8">
          <ResetPasswordForm />
        </div>
      ) : (
        <div role="alert" className="mt-8 rounded-2xl bg-red-50 p-6 text-sm text-red-800">
          <p>This link has expired, or it was opened in a different browser.</p>
          <p className="mt-3"><Link href="/forgot-password" className="font-medium underline">Ask for a new link</Link></p>
        </div>
      )}
    </div>
  );
}
