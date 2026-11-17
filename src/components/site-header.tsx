"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useCart } from "@/components/cart-context";

function SearchBox({ className }: { className?: string }) {
  return (
    <form action="/shop" method="get" role="search" className={className}>
      <label htmlFor="header-search" className="sr-only">
        Search products
      </label>
      <div className="relative">
        <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          id="header-search"
          name="q"
          type="search"
          placeholder="Search"
          className="h-10 w-full rounded-full border border-neutral-300 bg-white pl-9 pr-4 text-sm placeholder:text-neutral-500"
        />
      </div>
    </form>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, open } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <button
          className="rounded-full p-2 hover:bg-neutral-100 md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>

        <Link href="/" className="text-xl font-semibold tracking-[0.3em]" onClick={() => setMenuOpen(false)}>
          {siteConfig.name}
        </Link>

        <nav aria-label="Main" className="ml-6 hidden gap-6 text-sm md:flex">
          {siteConfig.nav.map((link) => (
            <Link key={link.href} href={link.href} className="text-neutral-700 hover:text-neutral-900 hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SearchBox className="hidden w-56 md:block" />
          <Link href="/account" aria-label="My account" className="rounded-full p-2 hover:bg-neutral-100">
            <User size={22} aria-hidden />
          </Link>
          <button
            onClick={open}
            aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
            className="relative rounded-full p-2 hover:bg-neutral-100"
          >
            <ShoppingBag size={22} aria-hidden />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-xs font-medium text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-neutral-200 bg-white px-4 py-4 md:hidden">
          <SearchBox className="mb-4" />
          <nav aria-label="Mobile" className="flex flex-col">
            {siteConfig.nav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-neutral-100 py-3 text-base"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
