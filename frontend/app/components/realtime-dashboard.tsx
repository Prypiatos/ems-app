'use client';

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Chip from '@mui/material/Chip';
import Link from 'next/link';

import { useAuth } from './auth-provider';
import { Toast } from './shared/toast';
import { OverviewTab } from './tabs/overview-tab';
import { LiveNodesTab } from './tabs/live-nodes-tab';
import { EventsTab } from './tabs/events-tab';
import { AdminTab } from './tabs/admin-tab';

// ── Exported types (shared by tabs) ──────────────────────────────────────────
export type ReadingRow = {
  nodeId: string;
  voltage: number;
  current: number;
  power: number;
  energyWh: number;
  time: string;
  ts: number;
};

export type NodeEvent = {
  timestamp: number;
  event_type: string;
  severity: string;
  message: string;
};

export type NodeHealth = {
  status: string;
  sequence_no: number;
  uptime_sec: number;
  sensor_ok: boolean;
  mqtt_connected: boolean;
  wifi_connected: boolean;
};

// ── Config ───────────────────────────────────────────────────────────────────
// WebSocket endpoint for Python backend (provided by user)
const WS_PATH = '/ws/live';
const PY_WS_URL = 'ws://192.168.51.139:8000/ws/live';
const NODES_PATH = '/api/v1/nodes';
const MAX_ROWS = 5000; // Large buffer to support longer time windows across multiple nodes
const TABS = ['Overview', 'Live Nodes', 'Events', 'Admin'] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
import { gatewayBase, apiFetch } from '../../lib/apiGateway';

function resolveWsUrl(): string {
  // Connect directly to Python backend websocket as requested
  return PY_WS_URL;
}

function fmtTime(input: unknown): string {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const ms = input > 1e12 ? input : input * 1000;
    return new Date(ms).toLocaleTimeString();
  }
  return new Date().toLocaleTimeString();
}

// ── Main Component ───────────────────────────────────────────────────────────
export function RealtimeDashboard() {
  const { token, username, logout } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [connected, setConnected] = useState(false);
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, NodeHealth>>({});
  const [eventsMap, setEventsMap] = useState<Record<string, NodeEvent[]>>({});
  const [toast, setToast] = useState('');

  // Throttle rendering: buffer WS messages, flush at 2 FPS
  const bufferRef = useRef<ReadingRow[]>([]);

  const baseUrl = useMemo(() => gatewayBase(), []);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  // ── Load nodes + health/events ──────────────────────────────────────────
  const loadNodes = useCallback(async () => {
    try {
      const res = await apiFetch(NODES_PATH, { headers: authHeaders });
      if (!res.ok) return;
      const list = ((await res.json()) as string[]).sort();
      
      // Prevent infinite loop: Only update if the list changed
      setNodes(prev => {
        if (JSON.stringify(prev) === JSON.stringify(list)) return prev;
        return list;
      });
    } catch { /* */ }
  }, [baseUrl, authHeaders]);

  const loadDetails = useCallback(async () => {
    const nodeList = nodes.length > 0 ? nodes : [];
    if (nodeList.length === 0) return;

    const newHealth: Record<string, NodeHealth> = {};
    const newEvents: Record<string, NodeEvent[]> = {};

    await Promise.all(
      nodeList.map(async (nodeId) => {
        try {
          const [hRes, eRes] = await Promise.all([
            apiFetch(`/api/v1/nodes/${nodeId}/health`, { headers: authHeaders }),
            apiFetch(`/api/v1/nodes/${nodeId}/events?limit=30`, { headers: authHeaders }),
          ]);
          if (hRes.ok) newHealth[nodeId] = await hRes.json();
          if (eRes.ok) newEvents[nodeId] = await eRes.json();
        } catch { /* */ }
      }),
    );

    setHealthMap((prev) => ({ ...prev, ...newHealth }));
    setEventsMap((prev) => ({ ...prev, ...newEvents }));
  }, [baseUrl, authHeaders, nodes]);

  // WebSocket for telemetry
  useEffect(() => {
    const ws = new WebSocket(resolveWsUrl());
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        const payload = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        
        // Handle Python backend format: avg_power, avg_voltage, avg_current, avg_energy_wh
        // Also fallback to original format: power, voltage, current, energy_wh
        const power = payload.avg_power ?? payload.power;
        const voltage = payload.avg_voltage ?? payload.voltage;
        const current = payload.avg_current ?? payload.current;
        const energyWh = payload.avg_energy_wh ?? payload.energy_wh ?? 0;
        
        if (typeof voltage !== 'number' || typeof power !== 'number') return;

        // Normalize timestamp: use window_start if available, otherwise timestamp
        let tsNum = Number(payload.window_start ?? payload.timestamp);
        if (!Number.isFinite(tsNum)) tsNum = Date.now();
        // If timestamp looks like seconds (e.g. ~1e9), convert to milliseconds.
        if (tsNum < 1e12) tsNum = tsNum * 1000;

        const nodeId = String(payload.node_id ?? 'unknown');

        const row: ReadingRow = {
          nodeId: nodeId,
          voltage: voltage,
          current: current ?? 0,
          power: power,
          energyWh: energyWh,
          time: fmtTime(tsNum),
          ts: tsNum,
        };
        bufferRef.current.push(row);

        // Also add this node to the nodes list if not already there
        setNodes((prev) => {
          if (!prev.includes(nodeId)) {
            return [...prev, nodeId].sort();
          }
          return prev;
        });
      } catch { /* */ }
    };

    return () => ws.close();
  }, []);

  // Flush buffer at 2 FPS
  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const batch = bufferRef.current.splice(0);
      setRows((prev) => [...batch, ...prev].slice(0, MAX_ROWS));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Polling for nodes + details
  // Use separate effects to prevent re-triggering the whole polling cycle
  useEffect(() => {
    loadNodes();
    const t = setInterval(loadNodes, 60000); // Poll nodes every 1 minute
    return () => clearInterval(t);
  }, [loadNodes]);

  useEffect(() => {
    loadDetails();
    const t = setInterval(loadDetails, 60000); // Poll details every 1 minute
    return () => clearInterval(t);
  }, [loadDetails]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Box className="min-h-screen bg-slate-50 flex flex-col">
      <AppBar position="sticky" color="inherit" elevation={1} className="border-b border-gray-200">
        <Toolbar className="px-4">
          <Typography variant="h6" color="primary" className="font-bold mr-6 hidden sm:block">
            ⚡ EMS
          </Typography>

          <Tabs
            value={tabIndex}
            onChange={(_, nv) => setTabIndex(nv)}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            className="flex-1"
          >
            {TABS.map((t) => (
              <Tab key={t} label={t} className="font-bold tracking-wide" />
            ))}
          </Tabs>

          <Box className="flex items-center gap-2 ml-4">
            <Link href="/stream-summary">
              <Button size="small" variant="text" className="font-bold">
                📈 Stream
              </Button>
            </Link>
            <Link href="/anomalies">
              <Button size="small" variant="text" className="font-bold">
                ⚠️ Anomalies
              </Button>
            </Link>
            <Link href="/recommendations">
              <Button size="small" variant="text" className="font-bold">
                💡 Recommend
              </Button>
            </Link>
          </Box>

          <Box className="flex items-center gap-4 ml-auto pl-4">
            <Chip
              label={connected ? 'Live' : 'Offline'}
              color={connected ? 'success' : 'error'}
              size="small"
              className="font-bold"
            />
            <Box className="hidden md:flex items-center gap-2 bg-gray-100 rounded-full pr-4 p-1">
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12, fontWeight: 'bold' }}>
                {(username ?? 'U').charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" color="text.secondary" className="font-bold">
                {username ?? 'User'}
              </Typography>
            </Box>
            <Button variant="text" color="inherit" size="small" onClick={logout} className="font-bold text-gray-500">
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" className="flex-1 py-8">
        {tabIndex === 0 && <OverviewTab nodes={nodes} rows={rows} healthMap={healthMap} events={eventsMap} connected={connected} />}
        {tabIndex === 1 && <LiveNodesTab nodes={nodes} rows={rows} healthMap={healthMap} />}
        {tabIndex === 2 && <EventsTab events={eventsMap} nodes={nodes} />}
        {tabIndex === 3 && <AdminTab />}
      </Container>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </Box>
  );
}
