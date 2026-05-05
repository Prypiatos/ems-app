'use client';

import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import DownloadIcon from '@mui/icons-material/Download';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';

import type { NodeEvent } from '../realtime-dashboard';

ChartJS.register(ArcElement, Tooltip, Legend);

type EventsTabProps = {
  events: Record<string, NodeEvent[]>;
  nodes: string[];
};

function parseTimestamp(input: number): string {
  const ms = input > 1_000_000_000_000 ? input : input * 1000;
  return new Date(ms).toLocaleTimeString();
}

export function EventsTab({ events, nodes }: EventsTabProps) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [nodeFilter, setNodeFilter] = useState<string>('all');

  const allEvents = useMemo(() => {
    const out: (NodeEvent & { nodeId: string })[] = [];
    for (const [nodeId, evts] of Object.entries(events)) {
      for (const e of evts) out.push({ ...e, nodeId });
    }
    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [events]);

  const filtered = useMemo(() => {
    let list = allEvents;
    if (nodeFilter !== 'all') list = list.filter((e) => e.nodeId === nodeFilter);
    if (severityFilter) list = list.filter((e) => e.severity === severityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.event_type.toLowerCase().includes(q) || e.message.toLowerCase().includes(q) || e.nodeId.toLowerCase().includes(q));
    }
    return list;
  }, [allEvents, nodeFilter, severityFilter, search]);

  const counts = useMemo(() => {
    const out = { high: 0, medium: 0, low: 0 };
    for (const e of allEvents) {
      if (e.severity === 'high') out.high++;
      else if (e.severity === 'medium') out.medium++;
      else out.low++;
    }
    return out;
  }, [allEvents]);

  const donutData = useMemo(() => ({
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [counts.high, counts.medium, counts.low],
      backgroundColor: ['#d32f2f', '#ed6c02', '#1976d2'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }), [counts]);

  const onExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ems-events-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityProps = (sev: string) => {
    switch(sev) {
      case 'high': return { color: 'error' as const, variant: 'filled' as const };
      case 'medium': return { color: 'warning' as const, variant: 'filled' as const };
      default: return { color: 'primary' as const, variant: 'outlined' as const };
    }
  };

  return (
    <Box className="pb-8">
      <Box className="flex justify-between items-center mb-6">
        <Box>
          <Typography variant="h4" component="h1" className="font-bold">
            Event Log
          </Typography>
          <Typography variant="body2" color="text.secondary" className="mt-1">
            {allEvents.length} total events across {nodes.length} nodes
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport}>
          Export JSON
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8, lg: 9 }}>
          <Card elevation={0} className="border border-gray-200">
            <CardContent>
              <Box className="flex flex-wrap gap-4 mb-6">
                <TextField
                  size="small"
                  variant="outlined"
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-grow md:max-w-xs"
                />
                <Select
                  size="small"
                  value={nodeFilter}
                  onChange={(e) => setNodeFilter(e.target.value)}
                  className="min-w-[150px]"
                >
                  <MenuItem value="all">All Nodes</MenuItem>
                  {nodes.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </Select>
                
                <Box className="flex items-center gap-2 ml-auto">
                  {(['high', 'medium', 'low'] as const).map((s) => (
                    <Chip
                      key={s}
                      label={`${s} (${counts[s]})`}
                      clickable
                      onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                      color={s === 'high' ? 'error' : s === 'medium' ? 'warning' : 'primary'}
                      variant={severityFilter === s ? 'filled' : 'outlined'}
                      className="capitalize font-bold"
                    />
                  ))}
                </Box>
              </Box>

              {filtered.length === 0 ? (
                <Typography color="text.secondary" className="text-center py-10">
                  No events match your filters
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><Typography variant="caption" color="text.secondary" className="font-bold">TIME</Typography></TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary" className="font-bold">NODE</Typography></TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary" className="font-bold">TYPE</Typography></TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary" className="font-bold">MESSAGE</Typography></TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary" className="font-bold">SEVERITY</Typography></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.slice(0, 50).map((e, i) => (
                        <TableRow key={`${e.timestamp}-${i}`} hover>
                          <TableCell className="whitespace-nowrap tabular-nums text-gray-500 text-xs">
                            {parseTimestamp(e.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={e.nodeId} color="primary" variant="outlined" className="font-bold text-xs" />
                          </TableCell>
                          <TableCell className="font-medium text-sm text-gray-800">{e.event_type}</TableCell>
                          <TableCell className="text-sm text-gray-600">{e.message}</TableCell>
                          <TableCell>
                            <Chip size="small" label={e.severity.toUpperCase()} className="text-[10px] font-bold" {...severityProps(e.severity)} />
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

        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
          <Card elevation={0} className="border border-gray-200">
            <CardContent>
              <Typography variant="h6" className="font-bold mb-6">
                Severity Breakdown
              </Typography>
              
              {allEvents.length === 0 ? (
                <Typography color="text.secondary" className="text-center py-8">
                  No events
                </Typography>
              ) : (
                <Box className="flex flex-col items-center">
                  <Box className="w-48 h-48 mb-6">
                    <Doughnut data={donutData} options={{ cutout: '70%', plugins: { legend: { display: false } } }} />
                  </Box>
                  <Box className="w-full">
                    <Box className="flex justify-between items-center mb-2">
                      <Box className="flex items-center gap-2 text-sm text-gray-600">
                        <Box className="w-3 h-3 rounded-full bg-red-600" /> High
                      </Box>
                      <Typography className="font-bold">{counts.high}</Typography>
                    </Box>
                    <Box className="flex justify-between items-center mb-2">
                      <Box className="flex items-center gap-2 text-sm text-gray-600">
                        <Box className="w-3 h-3 rounded-full bg-orange-500" /> Medium
                      </Box>
                      <Typography className="font-bold">{counts.medium}</Typography>
                    </Box>
                    <Box className="flex justify-between items-center">
                      <Box className="flex items-center gap-2 text-sm text-gray-600">
                        <Box className="w-3 h-3 rounded-full bg-blue-600" /> Low
                      </Box>
                      <Typography className="font-bold">{counts.low}</Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
