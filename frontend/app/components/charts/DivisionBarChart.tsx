"use client";

import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface Division {
  id: string;
  name: string;
  value: number;
}

interface DivisionBarChartProps {
  divisions: Division[];
  metric?: string;
}

const CHART_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export const DivisionBarChart = React.memo(function DivisionBarChart({
  divisions = [],
  metric = "Energy (kWh)",
}: DivisionBarChartProps) {
  const chartData = useMemo(() => {
    return {
      labels: divisions.map((d) => d.name),
      datasets: [
        {
          label: metric,
          data: divisions.map((d) => d.value),
          backgroundColor: divisions.map(
            (_, idx) => CHART_COLORS[idx % CHART_COLORS.length],
          ),
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [divisions, metric]);

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="h-80 w-full">
      {divisions.length > 0 ? (
        <Bar data={chartData} options={options} />
      ) : (
        <div className="flex h-full items-center justify-center rounded-lg border border-border-subtle bg-panel text-muted">
          No divisions data available
        </div>
      )}
    </div>
  );
});

DivisionBarChart.displayName = "DivisionBarChart";
