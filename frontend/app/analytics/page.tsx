"use client";

import { useEffect, useState } from 'react';
import { energyService } from '@/services/energyService';

interface Prediction {
  next_hour: number;
  confidence: number;
  trend: string;
  forecast: Array<{ t: number; v: number }>;
}

export default function AnalyticsPage() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const data = await energyService.getPredictions();
        setPrediction(data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Energy Analytics</h1>
        <p className="mt-2 text-muted">Predictive modeling and consumption trends.</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-panel border border-border-subtle" />
          <div className="h-64 animate-pulse rounded-2xl bg-panel border border-border-subtle" />
        </div>
      ) : prediction && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-border-subtle bg-panel p-6 shadow-sm">
              <p className="text-sm font-medium text-muted uppercase tracking-wider">Next Hour Forecast</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold">{prediction.next_hour}</span>
                <span className="text-lg text-muted">kWh</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className={`flex items-center gap-1 text-sm font-medium ${prediction.trend === 'increasing' ? 'text-red-500' : 'text-green-500'}`}>
                  {prediction.trend === 'increasing' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                  )}
                  <span className="capitalize">{prediction.trend}</span>
                </div>
                <span className="text-xs text-muted">• {(prediction.confidence * 100).toFixed(0)}% confidence</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-panel p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Insights</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>Peak usage expected in 2 hours</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>System efficiency is at 94%</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-border-subtle bg-panel p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Usage Forecast (3h)</h3>
            <div className="space-y-4">
              {prediction.forecast.map((point, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border-subtle pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{new Date(point.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs text-muted">Estimated Load</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{point.v}</span>
                    <span className="ml-1 text-xs text-muted">kWh</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-xl bg-accent/5 p-4 border border-accent/10">
              <p className="text-xs text-accent font-medium uppercase tracking-widest mb-1">AI Suggestion</p>
              <p className="text-sm text-fg/80">Consider shifting heavy loads to the next hour to optimize cost based on predicted trends.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
