export default function HistoryPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="mt-2 text-muted">Historical readings and time-series logs.</p>
      </header>
      <div className="rounded-2xl border border-border-subtle bg-panel p-6">
        <p className="text-sm text-muted">Timeline and event drill-down will render here.</p>
      </div>
    </section>
  );
}
