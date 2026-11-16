export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-8 space-y-4 text-neutral-700">{children}</div>
    </div>
  );
}
