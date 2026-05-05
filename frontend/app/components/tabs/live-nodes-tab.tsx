'use client';

import { useMemo } from 'react';
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

const TIME_WINDOW = 60; // show last 60 data points

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

const chartOptions = (title: string, color: string) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 } as const,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#ffffff',
      titleColor: '#1e293b',
      bodyColor: '#1e293b',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 4,
    },
  },
  scales: {
    x: {
      display: true,
      grid: { display: false },
      ticks: { maxTicksLimit: 6, font: { size: 10 }, color: '#64748b' },
    },
    y: {
      display: true,
      grid: { color: 'rgba(226,232,240,0.8)' },
      ticks: { font: { size: 10 }, color: '#64748b' },
    },
  },
  elements: {
    point: { radius: 0, hoverRadius: 4 },
    line: { borderWidth: 2, tension: 0.3 },
  },
});

function NodeRow({ nodeId, rows, health }: { nodeId: string; rows: ReadingRow[]; health?: NodeHealth }) {
  const nodeRows = useMemo(
    () => rows.filter((r) => r.nodeId === nodeId).slice(0, TIME_WINDOW).reverse(),
    [rows, nodeId],
  );

  const latest = nodeRows.length > 0 ? nodeRows[nodeRows.length - 1] : undefined;

  const healthScore = useMemo(() => {
    if (!health) return 0;
    let s = 40;
    if (health.status === 'online') s += 25;
    if (health.sensor_ok) s += 15;
    if (health.mqtt_connected) s += 10;
    if (health.wifi_connected) s += 10;
    return Math.min(100, s);
  }, [health]);

  const powerData = useMemo(() => ({
    labels: nodeRows.map((r) => r.time),
    datasets: [{
      label: 'Power (kW)',
      data: nodeRows.map((r) => r.power),
      borderColor: '#1976d2',
      backgroundColor: 'rgba(25,118,210,0.1)',
      fill: true,
    }],
  }), [nodeRows]);

  const voltageData = useMemo(() => ({
    labels: nodeRows.map((r) => r.time),
    datasets: [{
      label: 'Voltage (V)',
      data: nodeRows.map((r) => r.voltage),
      borderColor: '#ed6c02',
      backgroundColor: 'rgba(237,108,2,0.1)',
      fill: true,
    }],
  }), [nodeRows]);

  return (
    <Card elevation={0} className="mb-6 border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        <Box className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
          <Box className="flex items-center gap-4">
            <Typography variant="h6" className="font-bold">
              {nodeId}
            </Typography>
            <StatusBadge status={health?.status ?? 'unknown'} />
          </Box>
          <Box className="flex items-center gap-4">
            <Typography variant="caption" color="text.secondary">
              Uptime: {formatUptime(health?.uptime_sec)}
            </Typography>
            <Box className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden flex items-center">
              <Box className="h-full bg-green-500 transition-all duration-300" style={{ width: `${healthScore}%` }} />
            </Box>
            <Typography variant="caption" color="success.main" className="font-bold">
              {healthScore}%
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={4} className="mb-6">
          <Grid size={{ xs: 12, lg: 6 }}>
            <Box className="bg-gray-50 border border-gray-100 rounded-lg p-4 h-64">
              <Box className="flex items-center gap-2 mb-2">
                <Box className="w-2 h-2 rounded-full bg-blue-600" />
                <Typography variant="subtitle2" color="text.secondary" className="font-bold">
                  Power (kW)
                </Typography>
              </Box>
              <Box className="h-48">
                {nodeRows.length < 2 ? (
                  <Typography color="text.secondary" className="h-full flex items-center justify-center">
                    Waiting for telemetry...
                  </Typography>
                ) : (
                  <Line data={powerData} options={chartOptions('Power', '#1976d2')} />
                )}
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Box className="bg-gray-50 border border-gray-100 rounded-lg p-4 h-64">
              <Box className="flex items-center gap-2 mb-2">
                <Box className="w-2 h-2 rounded-full bg-orange-500" />
                <Typography variant="subtitle2" color="text.secondary" className="font-bold">
                  Voltage (V)
                </Typography>
              </Box>
              <Box className="h-48">
                {nodeRows.length < 2 ? (
                  <Typography color="text.secondary" className="h-full flex items-center justify-center">
                    Waiting for telemetry...
                  </Typography>
                ) : (
                  <Line data={voltageData} options={chartOptions('Voltage', '#ed6c02')} />
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <MetricCard label="Power" value={latest ? `${latest.power.toFixed(1)} kW` : '—'} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <MetricCard label="Voltage" value={latest ? `${latest.voltage.toFixed(1)} V` : '—'} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <MetricCard label="Current" value={latest ? `${latest.current.toFixed(2)} A` : '—'} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <MetricCard label="Energy" value={latest ? `${latest.energyWh.toFixed(1)} Wh` : '—'} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export function LiveNodesTab({ nodes, rows, healthMap }: LiveNodesTabProps) {
  return (
    <Box className="pb-8">
      <Box className="mb-6">
        <Typography variant="h4" component="h1" gutterBottom className="font-bold">
          Live Nodes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time telemetry · last {TIME_WINDOW} readings per node
        </Typography>
      </Box>
      
      {nodes.length === 0 ? (
        <Card elevation={0} className="border border-dashed border-gray-300 bg-transparent">
          <CardContent className="text-center py-16">
            <Typography color="text.secondary">
              No nodes discovered yet. Start the Kafka demo script to see data.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box>
          {nodes.map((nodeId) => (
            <NodeRow key={nodeId} nodeId={nodeId} rows={rows} health={healthMap[nodeId]} />
          ))}
        </Box>
      )}
    </Box>
  );
}
