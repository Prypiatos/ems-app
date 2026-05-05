'use client';

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';

import { MetricCard } from '../shared/metric-card';
import { StatusBadge } from '../shared/status-badge';
import type { ReadingRow, NodeHealth, NodeEvent } from '../realtime-dashboard';

type OverviewTabProps = {
  nodes: string[];
  rows: ReadingRow[];
  healthMap: Record<string, NodeHealth>;
  events: Record<string, NodeEvent[]>;
  connected: boolean;
};

export function OverviewTab({ nodes, rows, healthMap, events, connected }: OverviewTabProps) {
  const totalPower = useMemo(() => {
    const latestPerNode = new Map<string, ReadingRow>();
    for (const r of rows) {
      if (!latestPerNode.has(r.nodeId)) latestPerNode.set(r.nodeId, r);
    }
    let total = 0;
    for (const r of latestPerNode.values()) total += r.power;
    return total;
  }, [rows]);

  const onlineCount = useMemo(
    () => nodes.filter((n) => healthMap[n]?.status === 'online').length,
    [nodes, healthMap],
  );

  const totalAlerts = useMemo(() => {
    let count = 0;
    for (const evts of Object.values(events)) {
      count += evts.filter((e) => e.severity === 'high').length;
    }
    return count;
  }, [events]);

  const recentEvents = useMemo(() => {
    const all: (NodeEvent & { nodeId: string })[] = [];
    for (const [nodeId, evts] of Object.entries(events)) {
      for (const e of evts) all.push({ ...e, nodeId });
    }
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  }, [events]);

  const sparklinePerNode = useMemo(() => {
    const map: Record<string, (number | null)[]> = {};
    const WINDOW_SIZE = 120; // 2 minutes
    for (const n of nodes) {
      const filtered = rows.filter((r) => r.nodeId === n).slice(0, WINDOW_SIZE);
      const data = [...filtered].reverse();
      
      const paddingCount = WINDOW_SIZE - data.length;
      const padding = new Array(paddingCount).fill(null);
      map[n] = [...padding, ...data.map(r => r.power)];
    }
    return map;
  }, [nodes, rows]);

  return (
    <Box className="pb-8">
      <Box className="flex items-center gap-4 mb-6">
        <Typography variant="h4" component="h1" className="font-bold">
          System Overview
        </Typography>
        <StatusBadge status={connected ? 'online' : 'offline'} size="medium" />
      </Box>

      <Grid container spacing={3} className="mb-6">
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="Total Nodes" value={String(nodes.length)} sub={`${onlineCount} online`} status={onlineCount === nodes.length ? 'ok' : 'neutral'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="Total Power" value={`${totalPower.toFixed(1)} kW`} status="neutral" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="Active Alerts" value={String(totalAlerts)} status={totalAlerts > 0 ? 'bad' : 'ok'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="WebSocket" value={connected ? 'Connected' : 'Disconnected'} status={connected ? 'ok' : 'bad'} />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card elevation={0} className="border border-gray-200">
            <CardContent>
              <Typography variant="h6" className="font-bold mb-4">
                Node Status
              </Typography>
              <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nodes.map((nodeId) => {
                  const h = healthMap[nodeId];
                  const spark = sparklinePerNode[nodeId] ?? [];
                  const latest = rows.find((r) => r.nodeId === nodeId);
                  return (
                    <Card key={nodeId} variant="outlined" className="bg-gray-50">
                      <CardContent className="p-3">
                        <Box className="flex justify-between items-center mb-2">
                          <Typography variant="subtitle2" className="font-bold">
                            {nodeId}
                          </Typography>
                          <StatusBadge status={h?.status ?? 'unknown'} />
                        </Box>
                        <Box className="h-10 mb-2 w-full">
                          {spark.some((v) => v !== null) ? (
                            <svg viewBox={`0 0 ${spark.length} 40`} preserveAspectRatio="none" className="w-full h-full">
                              <polyline
                                fill="none"
                                stroke="#1976d2"
                                strokeWidth="2"
                                points={spark
                                  .map((v, i) => {
                                    if (v === null) return null;
                                    const validValues = spark.filter((x): x is number => x !== null);
                                    const min = Math.min(...validValues);
                                    const max = Math.max(...validValues);
                                    const range = max - min + 0.1;
                                    const y = 40 - ((v - min) / range) * 36;
                                    return `${i},${y}`;
                                  })
                                  .filter((p) => p !== null)
                                  .join(' ')}
                              />
                            </svg>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Waiting...
                            </Typography>
                          )}
                        </Box>
                        <Box className="flex justify-between text-xs text-gray-600 font-medium">
                          <span>{latest ? `${latest.power.toFixed(1)} kW` : '—'}</span>
                          <span>{latest ? `${latest.voltage.toFixed(1)} V` : '—'}</span>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
                {nodes.length === 0 && (
                  <Typography color="text.secondary" className="py-4 text-center col-span-full">
                    No nodes discovered yet
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} className="border border-gray-200 h-full">
            <CardContent>
              <Typography variant="h6" className="font-bold mb-4">
                Recent Events
              </Typography>
              {recentEvents.length === 0 ? (
                <Typography color="text.secondary" className="text-center py-8">
                  No events yet
                </Typography>
              ) : (
                <List disablePadding>
                  {recentEvents.map((e, i) => {
                    const sevColor = e.severity === 'high' ? 'error.main' : e.severity === 'medium' ? 'warning.main' : 'primary.main';
                    const sevBg = e.severity === 'high' ? 'error.light' : e.severity === 'medium' ? 'warning.light' : 'primary.light';
                    return (
                      <div key={`${e.timestamp}-${i}`}>
                        <ListItem alignItems="flex-start" className="px-0">
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: sevBg, color: sevColor, width: 32, height: 32, fontSize: 14, fontWeight: 'bold' }}>
                              {e.severity.charAt(0).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box className="flex justify-between items-center">
                                <Typography variant="subtitle2" color="primary.main" className="font-bold">
                                  {e.nodeId}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(e.timestamp > 1e12 ? e.timestamp : e.timestamp * 1000).toLocaleTimeString()}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Typography variant="body2" color="text.primary" className="mt-1 truncate">
                                {e.message}
                              </Typography>
                            }
                          />
                        </ListItem>
                        {i < recentEvents.length - 1 && <Divider component="li" />}
                      </div>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
