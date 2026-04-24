"use client";

import { useEffect, useState } from 'react';
import { alertService } from '@/services/alertService';

interface Alert {
  id: string;
  node_id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
  message: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const data = await alertService.getAlerts();
        setAlerts(data);
      } catch (err) {
        console.error("Failed to fetch alerts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">System Alerts</h1>
        <p className="mt-2 text-muted">Real-time notifications and critical system events.</p>
      </header>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-panel border border-border-subtle" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle p-12 text-center">
              <p className="text-muted">No active alerts detected.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`flex items-start gap-4 rounded-2xl border p-5 transition-all bg-panel ${
                  alert.severity === 'critical' ? 'border-red-500/20' : 
                  alert.severity === 'warning' ? 'border-yellow-500/20' : 'border-border-subtle'
                }`}
              >
                <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  alert.severity === 'critical' ? 'bg-red-500/10 text-red-500' : 
                  alert.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold capitalize">{alert.type.replace('_', ' ')}</h3>
                    <span className="text-xs text-muted">{new Date(alert.timestamp * 1000).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-fg/80">{alert.message}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Node: {alert.node_id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      alert.severity === 'critical' ? 'bg-red-500 text-white' : 
                      alert.severity === 'warning' ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
