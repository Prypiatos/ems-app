"use client";

import { useEffect, useState } from 'react';
import { energyService } from '@/services/energyService';

interface AggregateData {
  total_consumption: number;
  active_nodes: number;
  unit: string;
  history: Array<{ t: number; v: number }>;
}

export default function HistoryPage() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const historyData = await energyService.getAggregateData();
        setData(historyData);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Consumption History</h1>
        <p className="mt-2 text-muted">Historical energy usage data and audit logs.</p>
      </header>

      {loading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-panel border border-border-subtle" />
      ) : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle bg-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Cumulative Usage</p>
              <p className="mt-1 text-2xl font-bold">{data.total_consumption} {data.unit}</p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Monitored Nodes</p>
              <p className="mt-1 text-2xl font-bold">{data.active_nodes} units</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-panel p-6">
            <h3 className="font-semibold mb-6">Usage Log (Last 5 Hours)</h3>
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-muted uppercase text-[10px] tracking-widest">
                    <th className="pb-3 font-semibold">Timestamp</th>
                    <th className="pb-3 font-semibold">Recorded Consumption</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.history.map((entry, i) => (
                    <tr key={i} className="group hover:bg-soft/30 transition-colors">
                      <td className="py-4 font-medium">
                        {new Date(entry.t * 1000).toLocaleString()}
                      </td>
                      <td className="py-4">
                        <span className="font-semibold">{entry.v}</span>
                        <span className="ml-1 text-muted">{data.unit}</span>
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-500 uppercase tracking-tighter">Verified</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
