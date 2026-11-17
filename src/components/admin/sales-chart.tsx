"use client";

import { useState } from "react";
import { formatPKR } from "@/lib/utils";

export type DayPoint = { day: string; orders: number; sales: number };

const BAR = "#9B4D5E"; // brand rose, checked for contrast and color strength

function niceMax(n: number): number {
  if (n <= 0) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 2.5, 5, 10]) if (n <= m * pow) return m * pow;
  return 10 * pow;
}

function label(day: string) {
  const d = new Date(day + "T00:00:00");
  return {
    long: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    num: String(d.getDate()),
    month: d.toLocaleDateString("en-GB", { month: "short" }),
  };
}

// Sales per day, last 14 days. One series, so no legend: the heading names it.
export function SalesChart({ days }: { days: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = days.reduce((a, d) => a + d.sales, 0);
  const max = niceMax(Math.max(...days.map((d) => d.sales), 0));
  const best = days.reduce((bi, d, i) => (d.sales > days[bi].sales ? i : bi), 0);
  const H = 160;
  const ticks = [max, max / 2, 0];

  if (total === 0) {
    return <p className="rounded-xl bg-cream px-4 py-10 text-center text-sm text-neutral-600">No sales in the last 14 days yet. Orders show here once they are paid or confirmed.</p>;
  }

  return (
    <div>
      <div
        role="img"
        aria-label={`Sales per day for the last 14 days. Total ${formatPKR(total)}. Best day ${label(days[best].day).long}, ${formatPKR(days[best].sales)}.`}
        className="relative flex"
      >
        {/* y axis labels */}
        <div className="relative mr-2 w-12 shrink-0 text-right text-xs text-neutral-600" style={{ height: H }} aria-hidden>
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: (i / 2) * H }}>
              {t === 0 ? "0" : t >= 1000 ? `${t / 1000}k` : t}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* grid: recessive */}
          <div className="absolute inset-x-0 top-0" style={{ height: H }} aria-hidden>
            {ticks.map((t, i) => (
              <div key={t} className="absolute inset-x-0 border-t border-neutral-200" style={{ top: (i / 2) * H }} />
            ))}
          </div>

          <div className="relative flex" style={{ height: H }}>
            {days.map((d, i) => {
              const h = Math.round((d.sales / max) * (H - 2));
              const active = hover === i;
              return (
                <button
                  key={d.day}
                  type="button"
                  aria-label={`${label(d.day).long}: ${formatPKR(d.sales)}, ${d.orders} ${d.orders === 1 ? "order" : "orders"}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
                >
                  <span
                    className="block w-full max-w-[24px] rounded-t-[4px]"
                    style={{ height: h, background: BAR, opacity: hover === null || active ? 1 : 0.45, marginInline: 1 }}
                  />
                  {i === best && h > 0 && hover === null && (
                    <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-neutral-900" style={{ bottom: h + 4 }}>
                      {formatPKR(d.sales)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* x labels */}
          <div className="mt-1 flex text-xs text-neutral-600" aria-hidden>
            {days.map((d, i) => {
              const l = label(d.day);
              return (
                <span key={d.day} className="flex-1 text-center leading-tight">
                  {l.num}
                  {(i === 0 || l.num === "1") && <span className="block">{l.month}</span>}
                </span>
              );
            })}
          </div>

          {hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow"
              style={{ left: `${((hover + 0.5) / days.length) * 100}%`, top: -8, transform: "translate(-50%, -100%)" }}
            >
              <p className="font-medium">{label(days[hover].day).long}</p>
              <p className="text-neutral-700">{formatPKR(days[hover].sales)} · {days[hover].orders} {days[hover].orders === 1 ? "order" : "orders"}</p>
            </div>
          )}
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-700 underline">Show as table</summary>
        <table className="mt-2 w-full text-left text-sm">
          <caption className="sr-only">Sales per day, last 14 days</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-600">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">Orders</th>
              <th className="py-1 text-right font-medium">Sales</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-b border-neutral-100">
                <td className="py-1">{label(d.day).long}</td>
                <td className="py-1 text-right">{d.orders}</td>
                <td className="py-1 text-right">{formatPKR(d.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
