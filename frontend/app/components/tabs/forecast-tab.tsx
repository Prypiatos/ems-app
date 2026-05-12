'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ScriptableContext,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BoltIcon from '@mui/icons-material/Bolt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import { MetricCard } from '../shared/metric-card';
import { pyFetch } from '../../../lib/pythonClient';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type ForecastRow = {
  node_id: string;
  timestamp: number;
  predicted_consumption: number;
};

function formatDateShort(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getIntensityColor(ratio: number): string {
  if (ratio === 0) return '#e2e8f0';
  if (ratio < 0.25) return '#ddd6fe';
  if (ratio < 0.5) return '#a78bfa';
  if (ratio < 0.75) return '#7c3aed';
  return '#f97316';
}

function tsToDateStr(ts: number) {
  return new Date(ts).toISOString().split('T')[0];
}

export function ForecastTab() {
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    pyFetch('/forecast/forecasts')
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then(data => { if (mounted) setRows(data as ForecastRow[]); })
      .catch(err => { if (mounted) setError(String(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const nodes = useMemo(() => [...new Set(rows.map(r => r.node_id))].sort(), [rows]);

  useEffect(() => {
    if (nodes.length > 0 && !selectedNode) setSelectedNode(nodes[0]);
  }, [nodes, selectedNode]);

  const nodeRows = useMemo(() => rows.filter(r => r.node_id === selectedNode), [rows, selectedNode]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    nodeRows.forEach(r => dates.add(tsToDateStr(r.timestamp)));
    return [...dates].sort();
  }, [nodeRows]);

  useEffect(() => {
    if (availableDates.length > 0 && (!selectedDate || !availableDates.includes(selectedDate))) {
      const today = new Date().toISOString().split('T')[0];
      const best = availableDates.find(d => d >= today) ?? availableDates[availableDates.length - 1];
      setSelectedDate(best);
    }
  }, [availableDates, selectedDate]);

  const rowsForDay = useMemo(() =>
    nodeRows
      .filter(r => tsToDateStr(r.timestamp) === selectedDate)
      .sort((a, b) => a.timestamp - b.timestamp),
    [nodeRows, selectedDate],
  );

  // Overall node stats
  const allActive = useMemo(() => nodeRows.filter(r => r.predicted_consumption > 0), [nodeRows]);
  const totalForecast = useMemo(() => allActive.reduce((s, r) => s + r.predicted_consumption, 0), [allActive]);
  const peakForecast = useMemo(() => allActive.length > 0 ? Math.max(...allActive.map(r => r.predicted_consumption)) : 0, [allActive]);
  const avgForecast = useMemo(() => allActive.length > 0 ? totalForecast / allActive.length : 0, [allActive, totalForecast]);

  // Selected day stats
  const dayActive = useMemo(() => rowsForDay.filter(r => r.predicted_consumption > 0), [rowsForDay]);
  const dayTotal = useMemo(() => dayActive.reduce((s, r) => s + r.predicted_consumption, 0), [dayActive]);
  const dayPeak = useMemo(() => dayActive.length > 0 ? Math.max(...dayActive.map(r => r.predicted_consumption)) : 0, [dayActive]);
  const dayAvg = useMemo(() => dayActive.length > 0 ? dayTotal / dayActive.length : 0, [dayActive, dayTotal]);
  const peakRow = useMemo(() =>
    rowsForDay.reduce<ForecastRow | null>((best, r) =>
      !best || r.predicted_consumption > best.predicted_consumption ? r : best, null),
    [rowsForDay],
  );
  const peakTimeLabel = peakRow
    ? new Date(peakRow.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  const chartData = useMemo(() => ({
    labels: rowsForDay.map(r =>
      new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    ),
    datasets: [{
      label: 'Predicted Consumption (Wh)',
      data: rowsForDay.map(r => r.predicted_consumption > 0 ? r.predicted_consumption : null),
      borderColor: '#7c3aed',
      backgroundColor: (ctx: ScriptableContext<'line'>) => {
        const { chart } = ctx;
        const { chartArea } = chart;
        if (!chartArea) return 'rgba(124,58,237,0.15)';
        const g = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, 'rgba(124,58,237,0.28)');
        g.addColorStop(1, 'rgba(124,58,237,0.01)');
        return g;
      },
      fill: true,
      tension: 0.4,
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 7,
      pointBackgroundColor: '#7c3aed',
      spanGaps: false,
    }],
  }), [rowsForDay]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.92)',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          title: (items: { label: string }[]) => `⏱ ${items[0]?.label}`,
          label: (ctx: { parsed: { y: number | null } }) =>
            ctx.parsed.y != null ? `  Predicted: ${ctx.parsed.y.toFixed(2)} Wh` : '',
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
        title: { display: true, text: 'Consumption (Wh)', font: { size: 11 }, color: '#94a3b8' },
        border: { display: false },
      },
    },
  }), []);

  const hourBars = useMemo(() => Array.from({ length: 24 }, (_, h) => {
    const row = rowsForDay.find(r => new Date(r.timestamp).getHours() === h);
    return { hour: h, value: row?.predicted_consumption ?? 0 };
  }), [rowsForDay]);

  // All-days summary for the bottom overview
  const daySummaries = useMemo(() => availableDates.map(date => {
    const dr = nodeRows.filter(r => tsToDateStr(r.timestamp) === date);
    const total = dr.reduce((s, r) => s + r.predicted_consumption, 0);
    const count = dr.filter(r => r.predicted_consumption > 0).length;
    return { date, total, count };
  }), [availableDates, nodeRows]);

  const maxDayTotal = useMemo(() => Math.max(...daySummaries.map(d => d.total), 1), [daySummaries]);
  const currentDateIndex = availableDates.indexOf(selectedDate);

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
              Forecast
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Predicted energy consumption from the ML forecasting model.
            </Typography>
          </div>
          {/* Node selector */}
          {nodes.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {nodes.map(n => (
                <button
                  key={n}
                  onClick={() => { setSelectedNode(n); setSelectedDate(''); }}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    selectedNode === n
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </Box>

      {loading && (
        <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {!loading && !error && rows.length === 0 && (
        <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ py: 10, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ fontWeight: 600 }}>No forecast data available</Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Overall summary cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard
                label="Total Forecast"
                value={`${(totalForecast / 1000).toFixed(2)} kWh`}
                sub={`${allActive.length} active periods`}
                status="neutral"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Avg per Period" value={`${avgForecast.toFixed(1)} Wh`} status="neutral" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Peak Predicted" value={`${peakForecast.toFixed(1)} Wh`} status="neutral" />
            </Grid>
          </Grid>

          {/* Day detail card */}
          {availableDates.length > 0 && selectedDate && (
            <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', mb: 4 }}>
              <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Day Forecast</Typography>

                {/* Date nav */}
                <div className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                  <IconButton
                    size="small"
                    disabled={currentDateIndex <= 0}
                    onClick={() => setSelectedDate(availableDates[currentDateIndex - 1])}
                    sx={{ color: '#7c3aed', '&:disabled': { opacity: 0.3 } }}
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
                    sx={{ color: '#7c3aed', '&:disabled': { opacity: 0.3 } }}
                  >
                    <ChevronRightIcon />
                  </IconButton>

                  <span className="hidden sm:block text-xs font-semibold text-slate-400 ml-2">
                    {currentDateIndex + 1} / {availableDates.length}
                  </span>
                </div>

                {/* Day stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="rounded-2xl p-3.5 bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <BoltIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                      <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">Day Total</span>
                    </div>
                    <span className="text-xl font-black text-violet-900 tabular-nums">
                      {dayTotal.toFixed(1)}
                      <span className="text-sm font-semibold ml-1 text-violet-600">Wh</span>
                    </span>
                  </div>

                  <div className="rounded-2xl p-3.5 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <TrendingUpIcon sx={{ fontSize: 16, color: '#f97316' }} />
                      <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">Peak Period</span>
                    </div>
                    <span className="text-xl font-black text-orange-900 tabular-nums">
                      {dayPeak.toFixed(1)}
                      <span className="text-sm font-semibold ml-1 text-orange-600">Wh</span>
                    </span>
                    {peakTimeLabel && (
                      <span className="text-[10px] font-semibold text-orange-500">at {peakTimeLabel}</span>
                    )}
                  </div>

                  <div className="rounded-2xl p-3.5 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <QueryStatsIcon sx={{ fontSize: 16, color: '#1976d2' }} />
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Avg Period</span>
                    </div>
                    <span className="text-xl font-black text-blue-900 tabular-nums">
                      {dayAvg.toFixed(1)}
                      <span className="text-sm font-semibold ml-1 text-blue-600">Wh</span>
                    </span>
                  </div>

                  <div className="rounded-2xl p-3.5 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <AccessTimeIcon sx={{ fontSize: 16, color: '#059669' }} />
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Active</span>
                    </div>
                    <span className="text-xl font-black text-emerald-900 tabular-nums">
                      {dayActive.length}
                      <span className="text-sm font-semibold ml-1 text-emerald-600">periods</span>
                    </span>
                  </div>
                </div>

                {/* Chart + intensity strip */}
                {rowsForDay.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 font-semibold">No forecast data for this day</div>
                ) : (
                  <>
                    <Box sx={{ height: { xs: 240, sm: 320, md: 400 }, mb: 3 }}>
                      <Line data={chartData} options={chartOptions} />
                    </Box>

                    {/* Hour intensity strip */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        24-Hour Forecast Pattern
                      </p>
                      <div className="flex items-end gap-px h-14">
                        {hourBars.map(({ hour, value }) => {
                          const ratio = dayPeak > 0 ? value / dayPeak : 0;
                          const heightPct = Math.max(ratio * 100, ratio > 0 ? 6 : 2);
                          const isPeakHour = peakRow
                            ? new Date(peakRow.timestamp).getHours() === hour
                            : false;
                          return (
                            <div
                              key={hour}
                              className="flex-1 flex flex-col items-center justify-end group"
                              style={{ height: '100%' }}
                              title={`${String(hour).padStart(2, '0')}:00 — ${value.toFixed(1)} Wh`}
                            >
                              {isPeakHour && (
                                <div className="w-1 h-1 rounded-full bg-orange-500 mb-0.5 animate-pulse" />
                              )}
                              <div
                                className="w-full rounded-sm transition-all duration-200 group-hover:opacity-75"
                                style={{
                                  height: `${heightPct}%`,
                                  backgroundColor: isPeakHour ? '#f97316' : getIntensityColor(ratio),
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
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
              </CardContent>
            </Card>
          )}

          {/* All forecast days overview */}
          {daySummaries.length > 1 && (
            <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>All Forecast Days</Typography>
                <div className="flex flex-col gap-2">
                  {daySummaries.map(({ date, total, count }) => {
                    const widthPct = (total / maxDayTotal) * 100;
                    const isSelected = date === selectedDate;
                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`w-full text-left rounded-xl p-3 border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-violet-300 bg-violet-50'
                            : 'border-slate-100 bg-white hover:border-violet-200 hover:bg-violet-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-bold ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>
                            {formatDateLabel(date)}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 font-semibold">{count} active</span>
                            <span className={`text-sm font-black tabular-nums ${isSelected ? 'text-violet-700' : 'text-slate-800'}`}>
                              {total.toFixed(1)} Wh
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-violet-500' : 'bg-violet-300'}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
