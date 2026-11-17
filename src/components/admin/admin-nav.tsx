"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PackageOpen, Palette, Settings, ShoppingBag, Star, Tags, TicketPercent } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: PackageOpen },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/discounts", label: "Discounts", icon: TicketPercent },
  { href: "/admin/custom", label: "Custom orders", icon: Palette },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

// badges: how many things wait for you, by page address (shown as a small number)
export function AdminNav({ badges = {} }: { badges?: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="relative flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium lg:rounded-lg",
              active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
            )}
          >
            <Icon size={16} aria-hidden />
            {label}
            {badges[href] > 0 && (
              <span className={cn("ml-0.5 min-w-5 rounded-full px-1.5 text-center text-xs font-semibold", active ? "bg-white text-neutral-900" : "bg-accent-ink text-white")}>
                <span className="sr-only">, </span>{badges[href]}<span className="sr-only"> waiting</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
