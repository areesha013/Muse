import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/track-order-form";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your order with your order number and mobile number.",
};

export default function TrackOrderPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Track your order</h1>
      <p className="mt-3 mb-8 text-neutral-700">
        Enter your order number and the mobile number you used when ordering.
      </p>
      <TrackOrderForm />
    </div>
  );
}
