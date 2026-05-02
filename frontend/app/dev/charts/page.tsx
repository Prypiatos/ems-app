"use client";

import React, { useMemo } from "react";
import { LiveLineChart } from "@/app/components/charts/LiveLineChart";
import { DivisionBarChart } from "@/app/components/charts/DivisionBarChart";
import { GaugeWidget } from "@/app/components/charts/GaugeWidget";

export default function ChartsDevPage() {
  // Mock data for LiveLineChart - simulates real-time energy data
  const liveChartData = useMemo(() => {
    const now = Date.now();
    const dataPoints = [];

    for (let i = 0; i < 20; i++) {
      dataPoints.push({
        timestamp: now - (20 - i) * 3000, // 3 seconds apart
        value: 100 + Math.random() * 50 - 25, // 75-125 kW
      });
    }

    return dataPoints;
  }, []);

  // Mock data for DivisionBarChart
  const divisionsData = [
    { id: "1", name: "Building A", value: 450 },
    { id: "2", name: "Building B", value: 380 },
    { id: "3", name: "Building C", value: 520 },
    { id: "4", name: "Building D", value: 290 },
    { id: "5", name: "Building E", value: 410 },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-fg">Chart Components</h1>
          <p className="mt-2 text-sm text-muted">
            Reusable chart component library showcase with mock data
          </p>
        </div>

        {/* LiveLineChart Section */}
        <div className="rounded-lg border border-border-subtle bg-panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-fg">
            Live Line Chart
          </h2>
          <p className="mb-4 text-sm text-muted">
            Real-time energy data with 60-second rolling window
          </p>
          <div className="overflow-hidden rounded border border-border-subtle">
            <LiveLineChart
              data={liveChartData}
              windowSeconds={60}
              color="#3b82f6"
              label="Real-time Energy (kW)"
            />
          </div>
          <div className="mt-4 space-y-2 text-xs text-muted">
            <p>• Automatically drops data older than {60} seconds</p>
            <p>• Updates with new real-time data points</p>
            <p>• Shows up to 20 data points in this demo</p>
          </div>
        </div>

        {/* DivisionBarChart Section */}
        <div className="rounded-lg border border-border-subtle bg-panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-fg">
            Division Bar Chart
          </h2>
          <p className="mb-4 text-sm text-muted">
            Energy consumption by division/building
          </p>
          <div className="overflow-hidden rounded border border-border-subtle">
            <DivisionBarChart
              divisions={divisionsData}
              metric="Energy Consumption (kWh)"
            />
          </div>
          <div className="mt-4 space-y-2 text-xs text-muted">
            <p>
              • Displays {divisionsData.length} divisions with individual colors
            </p>
            <p>
              • Total consumption:{" "}
              {divisionsData.reduce((sum, d) => sum + d.value, 0)} kWh
            </p>
            <p>• Colors cycle through predefined palette</p>
          </div>
        </div>

        {/* GaugeWidget Section */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Gauge 1: Good Status */}
          <div className="rounded-lg border border-border-subtle bg-panel p-6">
            <h3 className="mb-4 text-sm font-semibold text-fg">
              System Status - Good
            </h3>
            <GaugeWidget value={25} max={100} unit="%" label="System Load" />
            <p className="mt-4 text-xs text-muted">
              Low load - green indicator
            </p>
          </div>

          {/* Gauge 2: Warning Status */}
          <div className="rounded-lg border border-border-subtle bg-panel p-6">
            <h3 className="mb-4 text-sm font-semibold text-fg">
              System Status - Warning
            </h3>
            <GaugeWidget value={50} max={100} unit="%" label="System Load" />
            <p className="mt-4 text-xs text-muted">
              Medium load - orange indicator
            </p>
          </div>

          {/* Gauge 3: Critical Status */}
          <div className="rounded-lg border border-border-subtle bg-panel p-6">
            <h3 className="mb-4 text-sm font-semibold text-fg">
              System Status - Critical
            </h3>
            <GaugeWidget value={85} max={100} unit="%" label="System Load" />
            <p className="mt-4 text-xs text-muted">High load - red indicator</p>
          </div>
        </div>

        {/* Custom Thresholds Gauge */}
        <div className="rounded-lg border border-border-subtle bg-panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-fg">
            Gauge Widget with Custom Thresholds
          </h2>
          <p className="mb-4 text-sm text-muted">
            Temperature monitoring with custom threshold ranges
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-sm text-muted">Temperature: 35°C</h3>
              <GaugeWidget
                value={35}
                max={80}
                unit="°C"
                label="Temperature"
                thresholds={[
                  {
                    min: 0,
                    max: 33,
                    color: "#10b981",
                    label: "Cool",
                  },
                  {
                    min: 33,
                    max: 66,
                    color: "#f59e0b",
                    label: "Warm",
                  },
                  {
                    min: 66,
                    max: 100,
                    color: "#ef4444",
                    label: "Hot",
                  },
                ]}
              />
            </div>
            <div>
              <h3 className="mb-4 text-sm text-muted">Temperature: 72°C</h3>
              <GaugeWidget
                value={72}
                max={80}
                unit="°C"
                label="Temperature"
                thresholds={[
                  {
                    min: 0,
                    max: 33,
                    color: "#10b981",
                    label: "Cool",
                  },
                  {
                    min: 33,
                    max: 66,
                    color: "#f59e0b",
                    label: "Warm",
                  },
                  {
                    min: 66,
                    max: 100,
                    color: "#ef4444",
                    label: "Hot",
                  },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Features Summary */}
        <div className="rounded-lg border border-border-subtle bg-panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-fg">Features</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="mb-2 font-semibold text-fg">LiveLineChart</h3>
              <ul className="space-y-1 text-sm text-muted">
                <li>✓ Rolling window filtering</li>
                <li>✓ Custom time windows</li>
                <li>✓ Customizable colors</li>
                <li>✓ React.memo optimized</li>
                <li>✓ Empty state handling</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-fg">DivisionBarChart</h3>
              <ul className="space-y-1 text-sm text-muted">
                <li>✓ Multi-division support</li>
                <li>✓ Auto color assignment</li>
                <li>✓ Responsive layout</li>
                <li>✓ React.memo optimized</li>
                <li>✓ Empty state handling</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-fg">GaugeWidget</h3>
              <ul className="space-y-1 text-sm text-muted">
                <li>✓ Dynamic color thresholds</li>
                <li>✓ Custom threshold ranges</li>
                <li>✓ Percentage display</li>
                <li>✓ React.memo optimized</li>
                <li>✓ Customizable units</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
