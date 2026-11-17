import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { shippingText } from "@/content/pages";
import { getSetting } from "@/lib/catalog";
import { formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Shipping and returns" };
export const revalidate = 60;

type Shipping = {
  flat_rate: number;
  free_shipping_over: number | null;
  use_city_rates: boolean;
  city_rates: Record<string, number>;
  other_city_rate: number;
};

export default async function ShippingPage() {
  const s = await getSetting<Shipping>("shipping", {
    flat_rate: 250,
    free_shipping_over: null,
    use_city_rates: false,
    city_rates: {},
    other_city_rate: 250,
  });

  return (
    <PageShell title="Shipping and returns">
      <h2 className="text-xl font-semibold text-neutral-900">Shipping</h2>
      <p>{shippingText.intro}</p>

      {s.use_city_rates ? (
        <ul className="list-inside list-disc">
          {Object.entries(s.city_rates).map(([city, fee]) => (
            <li key={city}>{city}: {formatPKR(fee)}</li>
          ))}
          <li>Other cities: {formatPKR(s.other_city_rate)}</li>
        </ul>
      ) : (
        <p>Delivery charge: {formatPKR(s.flat_rate)} per order.</p>
      )}
      {s.free_shipping_over ? <p>Free delivery on orders over {formatPKR(s.free_shipping_over)}.</p> : null}

      <h2 className="pt-4 text-xl font-semibold text-neutral-900">Returns and exchanges</h2>
      {shippingText.returns.map((r) => (
        <p key={r}>{r}</p>
      ))}
    </PageShell>
  );
}
