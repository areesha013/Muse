import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent-ink">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-neutral-600">It may have moved, or the product may no longer be available.</p>
      <Link href="/shop" className="mt-8 rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white hover:bg-neutral-700">
        Back to shop
      </Link>
    </div>
  );
}
