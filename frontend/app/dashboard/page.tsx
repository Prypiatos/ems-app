import { NodeGrid } from '../components/node-grid';
import { LiveMonitor } from '../components/live-monitor';

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted">Real-time system health and node status overview.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Nodes</h2>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">Status Check</span>
          </div>
          <NodeGrid />
        </div>
        
        <div className="lg:col-span-1">
          <LiveMonitor />
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-panel p-6">
        <h2 className="text-xl font-semibold mb-4">System Alerts</h2>
        <p className="text-sm text-muted italic">Monitoring for anomalies in energy distribution...</p>
      </div>
    </section>
  );
}
