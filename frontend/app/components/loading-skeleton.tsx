export function LoadingSkeleton() {
  return (
    <section className="space-y-6 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-soft" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-28 rounded-2xl bg-panel border border-border-subtle" />
        <div className="h-28 rounded-2xl bg-panel border border-border-subtle" />
        <div className="h-28 rounded-2xl bg-panel border border-border-subtle" />
      </div>
      <div className="h-72 rounded-2xl bg-panel border border-border-subtle" />
    </section>
  );
}