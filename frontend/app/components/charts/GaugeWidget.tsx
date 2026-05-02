"use client";

import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Threshold {
  min: number;
  max: number;
  color: string;
  label: string;
}

interface GaugeWidgetProps {
  value: number;
  max: number;
  unit?: string;
  label?: string;
  thresholds?: Threshold[];
}

const DEFAULT_THRESHOLDS: Threshold[] = [
  { min: 0, max: 33, color: "#10b981", label: "Good" },
  { min: 33, max: 66, color: "#f59e0b", label: "Warning" },
  { min: 66, max: 100, color: "#ef4444", label: "Critical" },
];

export const GaugeWidget = React.memo(function GaugeWidget({
  value,
  max,
  unit = "%",
  label = "Status",
  thresholds = DEFAULT_THRESHOLDS,
}: GaugeWidgetProps) {
  // Determine current color based on value and thresholds
  const currentColor = useMemo(() => {
    const percentage = (value / max) * 100;
    const matchedThreshold = thresholds.find(
      (t) => percentage >= t.min && percentage <= t.max,
    );
    return matchedThreshold?.color || "#6b7280";
  }, [value, max, thresholds]);

  const percentage = useMemo(() => {
    return Math.min((value / max) * 100, 100);
  }, [value, max]);

  const chartData = useMemo(() => {
    return {
      labels: ["Current", "Remaining"],
      datasets: [
        {
          data: [percentage, 100 - percentage],
          backgroundColor: [currentColor, "#e5e7eb"],
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [percentage, currentColor]);

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            if (context.label === "Current") {
              return `${value.toFixed(2)} ${unit}`;
            }
            return `${(max - value).toFixed(2)} ${unit}`;
          },
        },
      },
    },
  };

  return (
    <div className="flex h-80 w-full flex-col items-center justify-center rounded-lg border border-border-subtle bg-panel p-4">
      <h3 className="mb-4 text-sm font-medium text-fg">{label}</h3>
      <div className="h-48 w-48">
        <Doughnut data={chartData} options={options} />
      </div>
      <div className="mt-4 text-center">
        <div className="text-3xl font-bold" style={{ color: currentColor }}>
          {percentage.toFixed(1)}%
        </div>
        <div className="mt-1 text-xs text-muted">
          {value.toFixed(2)} / {max.toFixed(2)} {unit}
        </div>
      </div>
      <div className="mt-4 flex gap-4">
        {thresholds.map((threshold) => (
          <div key={threshold.label} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: threshold.color }}
            />
            <span className="text-xs text-muted">{threshold.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

GaugeWidget.displayName = "GaugeWidget";
