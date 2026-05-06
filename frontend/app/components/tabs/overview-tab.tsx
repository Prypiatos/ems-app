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
    <Box sx={{ pb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: -1 }}>
            System Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
            Real-time energy consumption and node status.
          </Typography>
        </Box>
        <StatusBadge status={connected ? 'Connected' : 'Disconnected'} size="medium" />
      </Box>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="Total Nodes" value={String(nodes.length)} sub={`${onlineCount} active now`} status={onlineCount === nodes.length ? 'ok' : 'neutral'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="Live Power" value={`${totalPower.toFixed(2)} kW`} status="neutral" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="System Alerts" value={String(totalAlerts)} sub="High priority" status={totalAlerts > 0 ? 'bad' : 'ok'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricCard label="Stream Health" value={connected ? 'Optimal' : 'Offline'} status={connected ? 'ok' : 'bad'} />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0, 0, 0, 0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 4 }}>
                Active Monitoring Nodes
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 3 }}>
                {nodes.map((nodeId) => {
                  const h = healthMap[nodeId];
                  const spark = sparklinePerNode[nodeId] ?? [];
                  const latest = rows.find((r) => r.nodeId === nodeId);
                  return (
                    <Card key={nodeId} variant="outlined" sx={{ borderRadius: 3, bgcolor: '#fcfdfe', border: '1px solid rgba(0,0,0,0.05)', transition: 'all 0.2s', '&:hover': { bgcolor: 'white', boxShadow: '0 8px 16px rgba(0,0,0,0.05)' } }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {nodeId}
                          </Typography>
                          <StatusBadge status={h?.status ?? 'unknown'} />
                        </Box>
                        <Box sx={{ height: 50, mb: 2, width: '100%', overflow: 'hidden' }}>
                          {spark.some((v) => v !== null) ? (
                            <svg viewBox={`0 0 ${spark.length} 40`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                              <defs>
                                <linearGradient id={`grad-${nodeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" style={{ stopColor: '#1976d2', stopOpacity: 0.2 }} />
                                  <stop offset="100%" style={{ stopColor: '#1976d2', stopOpacity: 0 }} />
                                </linearGradient>
                              </defs>
                              <path
                                d={`M 0 40 ${spark.map((v, i) => {
                                  if (v === null) return '';
                                  const validValues = spark.filter((x): x is number => x !== null);
                                  const min = Math.min(...validValues);
                                  const max = Math.max(...validValues);
                                  const range = max - min + 0.1;
                                  const y = 40 - ((v - min) / range) * 32;
                                  return `L ${i} ${y}`;
                                }).join(' ')} L ${spark.length} 40 Z`}
                                fill={`url(#grad-${nodeId})`}
                              />
                              <polyline
                                fill="none"
                                stroke="#1976d2"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={spark
                                  .map((v, i) => {
                                    if (v === null) return null;
                                    const validValues = spark.filter((x): x is number => x !== null);
                                    const min = Math.min(...validValues);
                                    const max = Math.max(...validValues);
                                    const range = max - min + 0.1;
                                    const y = 40 - ((v - min) / range) * 32;
                                    return `${i},${y}`;
                                  })
                                  .filter((p) => p !== null)
                                  .join(' ')}
                              />
                            </svg>
                          ) : (
                            <Box sx={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                Initializing...
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>POWER</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{latest ? `${latest.power.toFixed(1)} kW` : '—'}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>VOLTAGE</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{latest ? `${latest.voltage.toFixed(1)} V` : '—'}</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(0, 0, 0, 0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', height: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 4 }}>
                Recent Activity
              </Typography>
              {recentEvents.length === 0 ? (
                <Box sx={{ py: 10, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    No recent events detected
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {recentEvents.map((e, i) => {
                    const sevColor = e.severity === 'high' ? '#ef4444' : e.severity === 'medium' ? '#f59e0b' : '#3b82f6';
                    return (
                      <Box key={`${e.timestamp}-${i}`} sx={{ mb: i < recentEvents.length - 1 ? 2 : 0 }}>
                        <ListItem alignItems="flex-start" sx={{ px: 0, py: 1 }}>
                          <Box sx={{ minWidth: 4, alignSelf: 'stretch', bgcolor: sevColor, borderRadius: 1, mr: 2, opacity: 0.8 }} />
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                  {e.nodeId}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                  {new Date(e.timestamp > 1e12 ? e.timestamp : e.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', fontWeight: 500, fontSize: '0.825rem' }}>
                                {e.message}
                              </Typography>
                            }
                          />
                        </ListItem>
                        {i < recentEvents.length - 1 && <Divider sx={{ ml: 3, opacity: 0.4 }} />}
                      </Box>
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
