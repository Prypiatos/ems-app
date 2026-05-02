"use client";

import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface DataPoint {
  timestamp: number;
  value: number;
}

interface LiveLineChartProps {
  data: DataPoint[];
  windowSeconds?: number;
  color?: string;
  label?: string;
}

export const LiveLineChart = React.memo(function LiveLineChart({
  data,
  windowSeconds = 60,
  color = "#3b82f6",
  label = "Energy",
}: LiveLineChartProps) {
  // Filter data within rolling window (keep only last windowSeconds worth of data)
  // and sort chronologically so late-arriving older readings render correctly.
  const windowedData = useMemo(() => {
    if (data.length === 0) return [];

    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    return data
      .filter((point) => now - point.timestamp <= windowMs)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data, windowSeconds]);

  // Format data for Chart.js
  const chartData = useMemo(() => {
    return {
      labels: windowedData.map((point) => {
        const date = new Date(point.timestamp);
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }),
      datasets: [
        {
          label,
          data: windowedData.map((point) => point.value),
          borderColor: color,
          backgroundColor: `${color}20`,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: color,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [windowedData, color, label]);

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
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="h-80 w-full">
      {windowedData.length > 0 ? (
        <Line data={chartData} options={options} />
      ) : (
        <div className="flex h-full items-center justify-center rounded-lg border border-border-subtle bg-panel text-muted">
          No data available
        </div>
      )}
    </div>
  );
});

LiveLineChart.displayName = "LiveLineChart";
