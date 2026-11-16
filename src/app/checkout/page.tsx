import type { Metadata } from "next";
import { CheckoutForm, type MethodOption } from "@/components/checkout-form";
import { getSetting } from "@/lib/catalog";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PaymentSettings } from "@/lib/orders";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const revalidate = 60;

const HINTS: Record<PaymentMethod, string> = {
  cod: "Pay in cash when your order arrives.",
  jazzcash: "You'll get our JazzCash account details after placing the order.",
  easypaisa: "You'll get our Easypaisa account details after placing the order.",
  bank_transfer: "You'll get our bank details after placing the order, then upload your receipt.",
};

export default async function CheckoutPage() {
  const settings = await getSetting<PaymentSettings>("payments", { cod: { enabled: true } } as PaymentSettings);
  const order: PaymentMethod[] = ["cod", "jazzcash", "easypaisa", "bank_transfer"];
  const methods: MethodOption[] = order
    .filter((id) => settings[id]?.enabled)
    .map((id) => ({ id, label: PAYMENT_METHOD_LABEL[id], hint: HINTS[id] }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm methods={methods} />
    </div>
  );
}
