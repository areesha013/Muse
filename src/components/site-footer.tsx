import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getSetting, type StoreInfo } from "@/lib/catalog";

const fallbackStore: StoreInfo = {
  name: siteConfig.name,
  email: "",
  phone: "",
  address: "",
  instagram: "",
};

export async function SiteFooter() {
  const store = await getSetting<StoreInfo>("store", fallbackStore);

  return (
    <footer className="mt-24 border-t border-neutral-200 bg-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="text-lg font-semibold tracking-[0.3em]">{siteConfig.name}</p>
          <p className="mt-3 text-sm text-neutral-600">{siteConfig.tagline}</p>
        </div>

        <nav aria-label="Shop links">
          <h2 className="text-sm font-semibold">Shop</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li><Link href="/shop" className="hover:underline">All products</Link></li>
            <li><Link href="/shop?category=stickers" className="hover:underline">Stickers</Link></li>
            <li><Link href="/shop?category=crochet" className="hover:underline">Crochet</Link></li>
            <li><Link href="/shop?category=bundles" className="hover:underline">Bundles</Link></li>
          </ul>
        </nav>

        <nav aria-label="Help links">
          <h2 className="text-sm font-semibold">Help</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li><Link href="/track-order" className="hover:underline">Track your order</Link></li>
            <li><Link href="/faq" className="hover:underline">FAQ</Link></li>
            <li><Link href="/shipping-returns" className="hover:underline">Shipping and returns</Link></li>
            <li><Link href="/contact" className="hover:underline">Contact</Link></li>
            <li><Link href="/about" className="hover:underline">About us</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">Get in touch</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {store.email && <li><a href={`mailto:${store.email}`} className="hover:underline">{store.email}</a></li>}
            {store.phone && <li>{store.phone}</li>}
            {store.address && <li>{store.address}</li>}
            {store.instagram && (
              <li>
                <a href={store.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Instagram
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-neutral-600 sm:flex-row sm:justify-between sm:px-6">
          <p>&copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <p>Cash on delivery &middot; JazzCash &middot; Easypaisa &middot; Bank transfer</p>
        </div>
      </div>
    </footer>
  );
}
