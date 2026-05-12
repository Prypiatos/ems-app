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
  type ScriptableContext,
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
import IconButton from '@mui/material/IconButton';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BoltIcon from '@mui/icons-material/Bolt';
import SpeedIcon from '@mui/icons-material/Speed';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

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

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function getIntensityColor(ratio: number): string {
  if (ratio === 0) return '#e2e8f0';
  if (ratio < 0.25) return '#bfdbfe';
  if (ratio < 0.5) return '#60a5fa';
  if (ratio < 0.75) return '#2563eb';
  return '#f97316';
}

export function AnalyticsTab() {
  const [view, setView] = useState<'daily' | 'hourly'>('daily');
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

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

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    hourly.forEach(r => dates.add(r.hour_start.split('T')[0]));
    return [...dates].sort();
  }, [hourly]);

  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  const dailySorted = useMemo(() => [...daily].sort((a, b) => a.date.localeCompare(b.date)), [daily]);

  const hourlyForDay = useMemo(() =>
    [...hourly]
      .filter(r => r.hour_start.startsWith(selectedDate))
      .sort((a, b) => a.hour_start.localeCompare(b.hour_start)),
    [hourly, selectedDate],
  );

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
    labels: hourlyForDay.map(r =>
      new Date(r.hour_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    ),
    datasets: [
      {
        label: 'Avg Power (W)',
        data: hourlyForDay.map(r => r.avg_power_w),
        borderColor: '#1976d2',
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const { chart } = ctx;
          const { chartArea } = chart;
          if (!chartArea) return 'rgba(25,118,210,0.15)';
          const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(25,118,210,0.28)');
          gradient.addColorStop(1, 'rgba(25,118,210,0.01)');
          return gradient;
        },
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 7,
        pointBackgroundColor: '#1976d2',
        tension: 0.4,
      },
      {
        label: 'Peak Power (W)',
        data: hourlyForDay.map(r => r.peak_power_w),
        borderColor: '#f97316',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        fill: false,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#f97316',
        tension: 0.4,
      },
    ],
  }), [hourlyForDay]);

  const hourlyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: { font: { size: 12 }, boxWidth: 14, padding: 20, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.92)',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          title: (items: { label: string }[]) => `⏱ ${items[0]?.label}`,
          label: (item: { dataset: { label?: string }; formattedValue: string }) =>
            `  ${item.dataset.label}: ${item.formattedValue} W`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: '#94a3b8', maxRotation: 0 },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148,163,184,0.12)' },
        ticks: { font: { size: 10 }, color: '#94a3b8' },
        title: { display: true, text: 'Power (W)', font: { size: 11 }, color: '#94a3b8' },
        border: { display: false },
      },
    },
  }), []);

  const totalWh = useMemo(() => daily.reduce((s, r) => s + r.total_consumption_wh, 0), [daily]);
  const avgPower = useMemo(() => daily.length > 0 ? daily.reduce((s, r) => s + r.avg_power_w, 0) / daily.length : 0, [daily]);
  const peakPower = useMemo(() => daily.length > 0 ? Math.max(...daily.map(r => r.peak_power_w)) : 0, [daily]);

  const dayTotalWh = useMemo(() => hourlyForDay.reduce((s, r) => s + r.total_consumption_wh, 0), [hourlyForDay]);
  const dayAvgPower = useMemo(() => hourlyForDay.length > 0 ? hourlyForDay.reduce((s, r) => s + r.avg_power_w, 0) / hourlyForDay.length : 0, [hourlyForDay]);
  const dayPeakPower = useMemo(() => hourlyForDay.length > 0 ? Math.max(...hourlyForDay.map(r => r.peak_power_w)) : 0, [hourlyForDay]);

  const peakHourRow = useMemo(() => hourlyForDay.reduce<HourlyRow | null>((best, r) =>
    !best || r.peak_power_w > best.peak_power_w ? r : best, null), [hourlyForDay]);
  const peakHourLabel = peakHourRow
    ? new Date(peakHourRow.hour_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  const currentDateIndex = availableDates.indexOf(selectedDate);

  // Build full 24-hour array for the intensity strip
  const hourBars = useMemo(() => Array.from({ length: 24 }, (_, h) => {
    const row = hourlyForDay.find(r => new Date(r.hour_start).getHours() === h);
    return { hour: h, value: row?.avg_power_w ?? 0, peak: row?.peak_power_w ?? 0 };
  }), [hourlyForDay]);

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
          {/* Overall summary */}
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
              {/* Header */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {view === 'daily' ? 'Daily Consumption' : 'Hourly Power Usage'}
                </Typography>
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={(_, v) => v && setView(v)}
                  size="small"
                  sx={{ '& .MuiToggleButton-root': { fontWeight: 700, px: 2.5 } }}
                >
                  <ToggleButton value="daily">Daily</ToggleButton>
                  <ToggleButton value="hourly">Hourly</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* ── HOURLY VIEW ─────────────────────────────────────────── */}
              {view === 'hourly' && (
                <>
                  {availableDates.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                      <Typography color="text.secondary" sx={{ fontWeight: 600 }}>No hourly data available</Typography>
                    </Box>
                  ) : (
                    <>
                      {/* Date navigation */}
                      <div className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                        <IconButton
                          size="small"
                          disabled={currentDateIndex <= 0}
                          onClick={() => setSelectedDate(availableDates[currentDateIndex - 1])}
                          sx={{ color: '#1976d2', '&:disabled': { opacity: 0.3 } }}
                        >
                          <ChevronLeftIcon />
                        </IconButton>

                        <FormControl size="small" variant="standard" sx={{ flex: 1 }}>
                          <Select
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            disableUnderline
                            sx={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}
                            renderValue={v => (
                              <span className="font-bold text-slate-800">{formatDateShort(v)}</span>
                            )}
                          >
                            {availableDates.map(d => (
                              <MenuItem key={d} value={d} sx={{ fontWeight: 600 }}>
                                {formatDateLabel(d)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <IconButton
                          size="small"
                          disabled={currentDateIndex >= availableDates.length - 1}
                          onClick={() => setSelectedDate(availableDates[currentDateIndex + 1])}
                          sx={{ color: '#1976d2', '&:disabled': { opacity: 0.3 } }}
                        >
                          <ChevronRightIcon />
                        </IconButton>

                        <div className="hidden sm:flex items-center gap-1.5 ml-2">
                          <span className="text-xs font-semibold text-slate-400">
                            {currentDateIndex + 1} / {availableDates.length}
                          </span>
                        </div>
                      </div>

                      {/* Day stat cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        {/* Total energy */}
                        <div className="rounded-2xl p-3.5 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <BoltIcon sx={{ fontSize: 16, color: '#1976d2' }} />
                            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Total Energy</span>
                          </div>
                          <span className="text-xl font-black text-blue-900 tabular-nums">
                            {(dayTotalWh / 1000).toFixed(3)}
                            <span className="text-sm font-semibold ml-1 text-blue-600">kWh</span>
                          </span>
                        </div>

                        {/* Peak power */}
                        <div className="rounded-2xl p-3.5 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <SpeedIcon sx={{ fontSize: 16, color: '#f97316' }} />
                            <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">Peak Power</span>
                          </div>
                          <span className="text-xl font-black text-orange-900 tabular-nums">
                            {dayPeakPower.toFixed(1)}
                            <span className="text-sm font-semibold ml-1 text-orange-600">W</span>
                          </span>
                          {peakHourLabel && (
                            <span className="text-[10px] font-semibold text-orange-500">at {peakHourLabel}</span>
                          )}
                        </div>

                        {/* Avg power */}
                        <div className="rounded-2xl p-3.5 bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <ShowChartIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                            <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">Avg Power</span>
                          </div>
                          <span className="text-xl font-black text-violet-900 tabular-nums">
                            {dayAvgPower.toFixed(1)}
                            <span className="text-sm font-semibold ml-1 text-violet-600">W</span>
                          </span>
                        </div>

                        {/* Hours recorded */}
                        <div className="rounded-2xl p-3.5 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <AccessTimeIcon sx={{ fontSize: 16, color: '#059669' }} />
                            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Hours</span>
                          </div>
                          <span className="text-xl font-black text-emerald-900 tabular-nums">
                            {hourlyForDay.length}
                            <span className="text-sm font-semibold ml-1 text-emerald-600">/ 24</span>
                          </span>
                        </div>
                      </div>

                      {/* Main chart */}
                      {hourlyForDay.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-semibold">No data for this day</div>
                      ) : (
                        <>
                          <Box sx={{ height: { xs: 240, sm: 340, md: 420 }, mb: 3 }}>
                            <Line data={hourlyChartData} options={hourlyChartOptions} />
                          </Box>

                          {/* 24-hour intensity strip */}
                          <div className="mt-2">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                              24-Hour Power Pattern
                            </p>
                            <div className="flex items-end gap-px h-14">
                              {hourBars.map(({ hour, value }) => {
                                const ratio = dayPeakPower > 0 ? value / dayPeakPower : 0;
                                const heightPct = Math.max(ratio * 100, ratio > 0 ? 6 : 2);
                                const isPeakHour = peakHourRow
                                  ? new Date(peakHourRow.hour_start).getHours() === hour
                                  : false;
                                return (
                                  <div
                                    key={hour}
                                    className="flex-1 flex flex-col items-center justify-end group relative"
                                    style={{ height: '100%' }}
                                    title={`${String(hour).padStart(2, '0')}:00 — ${value.toFixed(1)} W`}
                                  >
                                    {isPeakHour && (
                                      <div className="w-1 h-1 rounded-full bg-orange-500 mb-0.5 animate-pulse" />
                                    )}
                                    <div
                                      className="w-full rounded-sm transition-all duration-200 group-hover:opacity-80"
                                      style={{
                                        height: `${heightPct}%`,
                                        backgroundColor: isPeakHour ? '#f97316' : getIntensityColor(ratio),
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            {/* Hour labels */}
                            <div className="flex mt-1">
                              {[0, 4, 8, 12, 16, 20, 23].map(h => (
                                <div
                                  key={h}
                                  className="text-[9px] text-slate-400 font-semibold"
                                  style={{ marginLeft: h === 0 ? '0%' : `${((h - (h === 23 ? 4 : 0)) / 24) * 100}%` }}
                                >
                                  {String(h).padStart(2, '0')}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── DAILY VIEW ──────────────────────────────────────────── */}
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
            </CardContent>
          </Card>

          {/* Daily breakdown table */}
          {view === 'daily' && dailySorted.length > 0 && (
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
