"use client"
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, Typography } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { pyFetch } from '../../lib/pythonClient';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

type SummaryRow = {
  node_id: string;
  window_start: number;
  window_end: number;
  avg_power: number;
  max_power?: number;
  avg_voltage?: number;
  avg_current?: number;
  avg_energy_wh?: number;
  record_count?: number;
};

export default function StreamSummary() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    pyFetch('/stream/summary')
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        if (mounted) setRows(data as SummaryRow[]);
      })
      .catch((err) => {
        if (mounted) setError(String(err));
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const chartData = React.useMemo(() => {
    // Group by node_id (simple: take first node or merge)
    const labels = rows.map(r => new Date(r.window_start));
    const avgPower = rows.map(r => Number((r.avg_power ?? 0).toFixed(3)));

    return {
      labels,
      datasets: [
        {
          label: 'Average Power (W)',
          data: avgPower,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.2,
        }
      ]
    };
  }, [rows]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: false }
    },
    scales: {
      x: {
        type: 'time' as const,
        time: { unit: 'second' }
      },
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <Card>
      <CardHeader title="Stream Summary" subheader="Average power over time" />
      <CardContent>
        {loading && <Typography>Loading...</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        {!loading && !error && rows.length === 0 && (
          <Typography>No data available</Typography>
        )}
        {!loading && !error && rows.length > 0 && (
          <div style={{ height: 360 }}>
            <Line data={chartData} options={options} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
