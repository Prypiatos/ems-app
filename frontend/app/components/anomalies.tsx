"use client";

import { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MuiTooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { MetricCard } from './shared/metric-card';
import { pyFetch } from '../../lib/pythonClient';

ChartJS.register(ArcElement, ChartTooltip, Legend);

type AnomalyRow = {
  node_id: string;
  timestamp: number;
  anomaly_type: string;
  score: number;
  severity: string;
};

function severityColor(s: string): 'error' | 'warning' | 'info' {
  if (s === 'high') return 'error';
  if (s === 'medium') return 'warning';
  return 'info';
}

function severityBorderColor(s: string): string {
  if (s === 'high') return '#ef4444';
  if (s === 'medium') return '#f59e0b';
  return '#3b82f6';
}

export default function Anomalies() {
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [nodeFilter, setNodeFilter] = useState<string>('all');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const load = () => {
    setLoading(true);
    setError(null);
    pyFetch('/anomalies')
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then(data => setRows(data as AnomalyRow[]))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const nodes = useMemo(() => [...new Set(rows.map(r => r.node_id))].sort(), [rows]);

  const counts = useMemo(() => ({
    high: rows.filter(r => r.severity === 'high').length,
    medium: rows.filter(r => r.severity === 'medium').length,
    low: rows.filter(r => r.severity === 'low').length,
  }), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (nodeFilter !== 'all') list = list.filter(r => r.node_id === nodeFilter);
    if (severityFilter !== 'all') list = list.filter(r => r.severity === severityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.anomaly_type.toLowerCase().includes(q) ||
        r.node_id.toLowerCase().includes(q) ||
        r.severity.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, nodeFilter, severityFilter, search]);

  const donutData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [counts.high, counts.medium, counts.low],
      backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
            Anomalies
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
            Detected anomalies and their severity scores.
          </Typography>
        </Box>
        <MuiTooltip title="Refresh">
          <span>
            <IconButton onClick={load} disabled={loading} color="primary">
              <RefreshIcon />
            </IconButton>
          </span>
        </MuiTooltip>
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
              <MetricCard label="High Severity" value={String(counts.high)} status={counts.high > 0 ? 'bad' : 'ok'} sub="Immediate attention" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Medium Severity" value={String(counts.medium)} status="neutral" sub="Monitor closely" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Low Severity" value={String(counts.low)} status="ok" sub="Informational" />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Main list */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  {/* Filters */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                    <TextField
                      size="small"
                      placeholder="Search anomalies..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      sx={{ flexGrow: 1, minWidth: 140 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Node</InputLabel>
                      <Select value={nodeFilter} label="Node" onChange={e => setNodeFilter(e.target.value)}>
                        <MenuItem value="all">All Nodes</MenuItem>
                        {nodes.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                      <InputLabel>Severity</InputLabel>
                      <Select value={severityFilter} label="Severity" onChange={e => setSeverityFilter(e.target.value)}>
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {filtered.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                      <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
                        {rows.length === 0 ? 'No anomalies detected' : 'No results match your filters'}
                      </Typography>
                    </Box>
                  ) : isMobile ? (
                    // Mobile: stacked cards
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {filtered.map((r, i) => (
                        <Card
                          key={i}
                          variant="outlined"
                          sx={{
                            borderRadius: 3,
                            borderLeft: `4px solid ${severityBorderColor(r.severity)}`,
                            bgcolor: '#fcfdfe',
                          }}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{r.node_id}</Typography>
                              <Chip size="small" label={r.severity.toUpperCase()} color={severityColor(r.severity)} />
                            </Box>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize', mb: 0.5 }}>
                              {r.anomaly_type.replace(/_/g, ' ')}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                Score: <strong>{r.score.toFixed(3)}</strong>
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(r.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  ) : (
                    // Desktop: table
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 460 }}>
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 800, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 } }}>
                            <TableCell>Time</TableCell>
                            <TableCell>Node</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell align="right">Score</TableCell>
                            <TableCell>Severity</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filtered.map((r, i) => (
                            <TableRow key={i} hover>
                              <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                {new Date(r.timestamp).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={r.node_id} color="primary" variant="outlined" />
                              </TableCell>
                              <TableCell sx={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>
                                {r.anomaly_type.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>
                                {r.score.toFixed(3)}
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={r.severity.toUpperCase()} color={severityColor(r.severity)} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Severity breakdown sidebar */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Severity Breakdown</Typography>
                  {rows.length === 0 ? (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ width: 180, height: 180 }}>
                        <Doughnut
                          data={donutData}
                          options={{ cutout: '68%', plugins: { legend: { display: false } } }}
                        />
                      </Box>
                      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {[
                          { label: 'High', count: counts.high, color: '#ef4444' },
                          { label: 'Medium', count: counts.medium, color: '#f59e0b' },
                          { label: 'Low', count: counts.low, color: '#3b82f6' },
                        ].map(({ label, count, color }) => (
                          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                              <Typography variant="body2" color="text.secondary">{label}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{count}</Typography>
                          </Box>
                        ))}
                        <Box sx={{ mt: 1, pt: 1.5, borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Total</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{rows.length}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
