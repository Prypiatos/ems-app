'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';

import { MetricCard } from '../shared/metric-card';
import { pyFetch } from '../../../lib/pythonClient';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

type DailyRow = {
  node_id: string;
  division: string | null;
  date: string;
  total_consumption_wh: number;
  avg_power_w: number;
  peak_power_w: number;
  reading_count: number;
};

type HourlyRow = {
  node_id: string;
  division: string | null;
  hour_start: string;
  total_consumption_wh: number;
  avg_power_w: number;
  peak_power_w: number;
  reading_count: number;
};

const BAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#64748b' } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#64748b' } },
  },
};

const LINE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const, labels: { font: { size: 11 } } } },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 8, autoSkip: true, font: { size: 10 }, color: '#64748b' } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#64748b' } },
  },
  elements: { point: { radius: 0 }, line: { tension: 0.3 } },
};

export function AnalyticsTab() {
  const [view, setView] = useState<'daily' | 'hourly'>('daily');
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      pyFetch('/analytics/daily').then(r => { if (!r.ok) throw new Error(`Daily: ${r.status}`); return r.json(); }),
      pyFetch('/analytics/hourly').then(r => { if (!r.ok) throw new Error(`Hourly: ${r.status}`); return r.json(); }),
    ])
      .then(([d, h]) => {
        if (!mounted) return;
        setDaily(d as DailyRow[]);
        setHourly(h as HourlyRow[]);
      })
      .catch(err => { if (mounted) setError(String(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const dailySorted = useMemo(() => [...daily].sort((a, b) => a.date.localeCompare(b.date)), [daily]);
  const hourlySorted = useMemo(() => [...hourly].sort((a, b) => a.hour_start.localeCompare(b.hour_start)), [hourly]);

  const dailyChartData = useMemo(() => ({
    labels: dailySorted.map(r => r.date),
    datasets: [{
      label: 'Consumption (Wh)',
      data: dailySorted.map(r => r.total_consumption_wh),
      backgroundColor: 'rgba(25,118,210,0.75)',
      borderRadius: 6,
      borderSkipped: false,
    }],
  }), [dailySorted]);

  const hourlyChartData = useMemo(() => ({
    labels: hourlySorted.map(r => {
      const d = new Date(r.hour_start);
      return d.toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: 'Avg Power (W)',
        data: hourlySorted.map(r => r.avg_power_w),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.1)',
        fill: true,
      },
      {
        label: 'Peak Power (W)',
        data: hourlySorted.map(r => r.peak_power_w),
        borderColor: '#ed6c02',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
      },
    ],
  }), [hourlySorted]);

  const totalWh = useMemo(() => daily.reduce((s, r) => s + r.total_consumption_wh, 0), [daily]);
  const avgPower = useMemo(() => daily.length > 0 ? daily.reduce((s, r) => s + r.avg_power_w, 0) / daily.length : 0, [daily]);
  const peakPower = useMemo(() => daily.length > 0 ? Math.max(...daily.map(r => r.peak_power_w)) : 0, [daily]);

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
          Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
          Historical energy consumption and power usage analytics.
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {!loading && !error && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard
                label="Total Consumption"
                value={`${(totalWh / 1000).toFixed(2)} kWh`}
                sub={`Over ${daily.length} days`}
                status="neutral"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Avg Daily Power" value={`${avgPower.toFixed(1)} W`} status="neutral" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Peak Power" value={`${peakPower.toFixed(1)} W`} status="neutral" />
            </Grid>
          </Grid>

          <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', mb: 4 }}>
            <CardContent sx={{ p: { xs: 2, md: 4 } }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {view === 'daily' ? 'Daily Consumption (Wh)' : 'Hourly Power Usage (W)'}
                </Typography>
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={(_, v) => v && setView(v)}
                  size="small"
                  sx={{ '& .MuiToggleButton-root': { fontWeight: 700, px: 2 } }}
                >
                  <ToggleButton value="daily">Daily</ToggleButton>
                  <ToggleButton value="hourly">Hourly</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {view === 'daily' && (
                dailySorted.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography color="text.secondary" sx={{ fontWeight: 600 }}>No daily data available</Typography>
                  </Box>
                ) : (
                  <Box sx={{ height: { xs: 220, sm: 300, md: 360 } }}>
                    <Bar data={dailyChartData} options={BAR_OPTIONS} />
                  </Box>
                )
              )}

              {view === 'hourly' && (
                hourlySorted.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography color="text.secondary" sx={{ fontWeight: 600 }}>No hourly data available</Typography>
                  </Box>
                ) : (
                  <Box sx={{ height: { xs: 220, sm: 300, md: 360 } }}>
                    <Line data={hourlyChartData} options={LINE_OPTIONS} />
                  </Box>
                )
              )}
            </CardContent>
          </Card>

          {/* Daily breakdown table */}
          {dailySorted.length > 0 && (
            <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Daily Breakdown</Typography>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 400 }}>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 800, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 } }}>
                        <TableCell>Date</TableCell>
                        <TableCell>Node</TableCell>
                        <TableCell align="right">Total (Wh)</TableCell>
                        <TableCell align="right">Avg Power (W)</TableCell>
                        <TableCell align="right">Peak (W)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...dailySorted].reverse().map((r, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.date}</TableCell>
                          <TableCell>
                            <Chip size="small" label={r.node_id} color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>
                            {r.total_consumption_wh.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>
                            {r.avg_power_w.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', fontWeight: 700 }}>
                            {r.peak_power_w.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
