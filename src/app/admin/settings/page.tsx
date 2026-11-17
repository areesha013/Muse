import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PaymentsForm, ShippingForm, StoreForm } from "@/components/admin/settings-forms";
import type { PaymentSettingsInput, StoreSettingsInput } from "@/app/actions/admin-settings";

export const metadata: Metadata = { title: "Settings" };

const STORE: StoreSettingsInput = { name: "MUSE", email: "", phone: "", address: "", instagram: "" };
const SHIPPING = { flat_rate: 250, free_shipping_over: null as number | null, use_city_rates: false, city_rates: {} as Record<string, number>, other_city_rate: 300 };
const PAYMENTS: PaymentSettingsInput = {
  cod: { enabled: true },
  jazzcash: { enabled: false, account_title: "", number: "" },
  easypaisa: { enabled: false, account_title: "", number: "" },
  bank_transfer: { enabled: false, bank_name: "", account_title: "", account_number: "", iban: "" },
};

export default async function SettingsPage() {
  const { data } = await createClient().from("settings").select("key, value").in("key", ["store", "shipping", "payments"]);
  const by = new Map((data ?? []).map((r) => [r.key as string, r.value as Record<string, unknown>]));
  const store = { ...STORE, ...(by.get("store") ?? {}) } as StoreSettingsInput;
  const shipping = { ...SHIPPING, ...(by.get("shipping") ?? {}) };
  const p = (by.get("payments") ?? {}) as Partial<PaymentSettingsInput>;
  const payments: PaymentSettingsInput = {
    cod: { ...PAYMENTS.cod, ...p.cod },
    jazzcash: { ...PAYMENTS.jazzcash, ...p.jazzcash },
    easypaisa: { ...PAYMENTS.easypaisa, ...p.easypaisa },
    bank_transfer: { ...PAYMENTS.bank_transfer, ...p.bank_transfer },
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <PaymentsForm initial={payments} />
      <ShippingForm initial={shipping} />
      <StoreForm initial={store} />
    </div>
  );
}
