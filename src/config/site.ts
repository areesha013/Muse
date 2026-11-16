// Edit this one file to rebrand the whole site.
export const siteConfig = {
  name: "MUSE",
  tagline: "Handmade stickers and crochet, made with love", // TODO: your own tagline
  description:
    "Handmade stickers, crochet keychains, plushies, flowers, bundles and wearables from Pakistan.",
  whatsappNumber: "923000000000", // TODO: your number, international format, no + or spaces
  currency: "PKR",
  locale: "en-PK",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  // Home page hero text
  hero: {
    eyebrow: "Handmade in Pakistan",
    headline: "Little things, made by hand.",
    subtext: "Stickers and crochet keychains, plushies and flowers, made one at a time.",
  },

  nav: [
    { label: "Shop", href: "/shop" },
    { label: "Bundles", href: "/shop?category=bundles" },
    { label: "About", href: "/about" },
    { label: "Track order", href: "/track-order" },
    { label: "Contact", href: "/contact" },
  ],
} as const;
