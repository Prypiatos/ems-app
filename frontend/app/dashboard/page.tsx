export default function DashboardPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted">Welcome to the operations overview.</p>
      </header>
      <div className="rounded-2xl border border-border-subtle bg-panel p-6">
        <p className="text-sm text-muted">KPI and system health widgets will render here.</p>
      </div>
    </section>
  );
}
