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
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { MetricCard } from '../shared/metric-card';
import { pyFetch } from '../../../lib/pythonClient';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type ForecastRow = {
  node_id: string;
  timestamp: number;
  predicted_consumption: number;
};

export function ForecastTab() {
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const sorted = useMemo(() => [...rows].sort((a, b) => a.timestamp - b.timestamp), [rows]);
  const active = useMemo(() => sorted.filter(r => r.predicted_consumption > 0), [sorted]);

  const totalForecast = useMemo(() => active.reduce((s, r) => s + r.predicted_consumption, 0), [active]);
  const avgForecast = useMemo(() => active.length > 0 ? totalForecast / active.length : 0, [active, totalForecast]);
  const peakForecast = useMemo(() => active.length > 0 ? Math.max(...active.map(r => r.predicted_consumption)) : 0, [active]);

  const chartData = useMemo(() => ({
    labels: sorted.map(r =>
      new Date(r.timestamp).toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    ),
    datasets: [{
      label: 'Predicted Consumption (Wh)',
      data: sorted.map(r => r.predicted_consumption > 0 ? r.predicted_consumption : null),
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124,58,237,0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      spanGaps: false,
    }],
  }), [sorted]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff',
        titleColor: '#1e293b',
        bodyColor: '#1e293b',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => ctx.parsed.y != null ? `${ctx.parsed.y.toFixed(2)} Wh` : '',
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: isMobile ? 4 : 8, autoSkip: true, font: { size: 10 }, color: '#64748b' },
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 }, color: '#64748b' },
        grid: { color: 'rgba(226,232,240,0.8)' },
      },
    },
    elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
  };

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
          Forecast
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
          Predicted energy consumption from the ML forecasting model.
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
                label="Total Forecast"
                value={`${totalForecast.toFixed(1)} Wh`}
                sub={`${active.length} active periods`}
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

          {rows.length === 0 ? (
            <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)' }}>
              <CardContent sx={{ py: 10, textAlign: 'center' }}>
                <Typography color="text.secondary" sx={{ fontWeight: 600 }}>No forecast data available</Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', mb: 4 }}>
                <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Consumption Forecast</Typography>
                    <Chip
                      size="small"
                      label={`${sorted.length} data points`}
                      color="secondary"
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                  </Box>
                  <Box sx={{ height: { xs: 220, sm: 300, md: 380 } }}>
                    <Line data={chartData} options={chartOptions} />
                  </Box>
                </CardContent>
              </Card>

              {/* Upcoming non-zero forecasts table */}
              {active.length > 0 && (
                <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
                  <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Forecast Schedule</Typography>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 340 }}>
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 800, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 } }}>
                            <TableCell>Time</TableCell>
                            <TableCell>Node</TableCell>
                            <TableCell align="right">Predicted (Wh)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {active.slice(0, 20).map((r, i) => (
                            <TableRow key={i} hover>
                              <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                {new Date(r.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={r.node_id} color="secondary" variant="outlined" />
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', color: '#7c3aed' }}>
                                {r.predicted_consumption.toFixed(2)}
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
        </>
      )}
    </Box>
  );
}
