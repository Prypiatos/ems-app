export default function AlertsPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold">Alerts</h1>
        <p className="mt-2 text-muted">Active alerts, thresholds, and notifications.</p>
      </header>
      <div className="rounded-2xl border border-border-subtle bg-panel p-6">
        <p className="text-sm text-muted">Alert feed and escalation controls will render here.</p>
      </div>
    </section>
  );
}
