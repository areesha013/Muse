import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-2 text-neutral-600">Type your email. We will send you a link to choose a new one.</p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
