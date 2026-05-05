'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import { MetricCard } from '../shared/metric-card';
import { StatusBadge } from '../shared/status-badge';
import type { ReadingRow, NodeHealth } from '../realtime-dashboard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const WINDOW_SECONDS = 600; // 10 minutes

type LiveNodesTabProps = {
  nodes: string[];
  rows: ReadingRow[];
  healthMap: Record<string, NodeHealth>;
};

function formatUptime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

const chartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      backgroundColor: '#ffffff',
      titleColor: '#1e293b',
      bodyColor: '#1e293b',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: 10,
    },
  },
  scales: {
    x: {
      display: true,
      grid: { display: false },
      ticks: { 
        maxTicksLimit: 6, 
        font: { size: 10 }, 
        color: '#64748b',
        autoSkip: true,
      },
    },
    y: {
      display: true,
      beginAtZero: true,
      grid: { color: 'rgba(226,232,240,0.8)' },
      ticks: { font: { size: 10 }, color: '#64748b' },
    },
  },
  elements: {
    point: { radius: 0 },
    line: { borderWidth: 2, tension: 0.1 },
  },
});

function NodeRow({ nodeId, rows, health, now }: { nodeId: string; rows: ReadingRow[]; health?: NodeHealth; now: number }) {
  const { dataPoints, labels, latest } = useMemo(() => {
    const dataWindow: (ReadingRow | null)[] = new Array(WINDOW_SECONDS).fill(null);
    const labelWindow: string[] = new Array(WINDOW_SECONDS).fill('');

    // Labels represent the exact second for each slot
    for (let i = 0; i < WINDOW_SECONDS; i++) {
      const slotTs = now - (WINDOW_SECONDS - 1 - i) * 1000;
      labelWindow[i] = new Date(slotTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    const nodeReadings = rows.filter((r) => r.nodeId === nodeId);
    let mostRecent: ReadingRow | undefined;

    for (const r of nodeReadings) {
      const age = Math.floor((now - r.ts) / 1000);
      if (age >= 0 && age < WINDOW_SECONDS) {
        const idx = (WINDOW_SECONDS - 1) - age;
        if (!dataWindow[idx] || r.ts > dataWindow[idx]!.ts) {
          dataWindow[idx] = r;
        }
        if (!mostRecent || r.ts > mostRecent.ts) mostRecent = r;
      }
    }

    return { dataPoints: dataWindow, labels: labelWindow, latest: mostRecent };
  }, [rows, nodeId, now]);

  const powerData = {
    labels,
    datasets: [{
      label: 'Power (kW)',
      data: dataPoints.map((p) => p ? p.power : null),
      borderColor: '#1976d2',
      backgroundColor: 'rgba(25,118,210,0.1)',
      fill: true,
      spanGaps: true,
    }],
  };

  const voltageData = {
    labels,
    datasets: [{
      label: 'Voltage (V)',
      data: dataPoints.map((p) => p ? p.voltage : null),
      borderColor: '#ed6c02',
      backgroundColor: 'rgba(237,108,2,0.1)',
      fill: true,
      spanGaps: true,
    }],
  };

  return (
    <Card elevation={0} className="mb-8 border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        <Box className="flex justify-between items-center mb-6">
          <Box className="flex items-center gap-3">
            <Typography variant="h6" className="font-bold">{nodeId}</Typography>
            <StatusBadge status={health?.status ?? 'unknown'} />
          </Box>
          {health?.uptime_sec !== undefined && (
            <Typography variant="caption" color="text.secondary">
              Uptime: {Math.floor(health.uptime_sec / 60)}m
            </Typography>
          )}
        </Box>

        <Grid container spacing={4} className="mb-6">
          <Grid size={{ xs: 12, lg: 6 }}>
            <Box className="bg-gray-50 rounded-lg p-4 h-64 border border-gray-100">
              <Typography variant="subtitle2" color="text.secondary" className="font-bold mb-2">Power (kW)</Typography>
              <Box className="h-48">
                <Line data={powerData} options={chartOptions()} />
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Box className="bg-gray-50 rounded-lg p-4 h-64 border border-gray-100">
              <Typography variant="subtitle2" color="text.secondary" className="font-bold mb-2">Voltage (V)</Typography>
              <Box className="h-48">
                <Line data={voltageData} options={chartOptions()} />
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><MetricCard label="Power" value={latest ? `${latest.power.toFixed(1)} kW` : '—'} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><MetricCard label="Voltage" value={latest ? `${latest.voltage.toFixed(1)} V` : '—'} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><MetricCard label="Current" value={latest ? `${latest.current.toFixed(2)} A` : '—'} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><MetricCard label="Energy" value={latest ? `${latest.energyWh.toFixed(1)} Wh` : '—'} /></Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export function LiveNodesTab({ nodes, rows, healthMap }: LiveNodesTabProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box className="pb-8">
      <Box className="mb-6">
        <Typography variant="h4" className="font-bold">Live Nodes</Typography>
        <Typography variant="body2" color="text.secondary">Real-time telemetry · past 10 minutes</Typography>
      </Box>
      
      {nodes.length === 0 ? (
        <Typography color="text.secondary" className="text-center py-20">No nodes discovered yet.</Typography>
      ) : (
        <Box>
          {(() => {
            const visible = nodes.filter((nodeId) => rows.some((r) => r.nodeId === nodeId && now - r.ts <= WINDOW_SECONDS * 1000));
            if (visible.length === 0) {
              return <Typography color="text.secondary" className="text-center py-20">No active nodes with data in the last 10 minutes.</Typography>;
            }
            return visible.map((nodeId) => (
              <NodeRow key={nodeId} nodeId={nodeId} rows={rows} health={healthMap[nodeId]} now={now} />
            ));
          })()}
        </Box>
      )}
    </Box>
  );
}
