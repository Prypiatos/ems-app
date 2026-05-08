'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import { useAuth } from './auth-provider';
import { Shell } from './shared/shell';
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
const MAX_ROWS = 5000;

// ── Helpers ──────────────────────────────────────────────────────────────────
import { wsUrl } from '../../lib/apiGateway';

function resolveWsUrl(): string {
  return wsUrl('/py/ws/live');
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
  const { roles } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [connected, setConnected] = useState(false);
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, NodeHealth>>({});
  const [eventsMap, setEventsMap] = useState<Record<string, NodeEvent[]>>({});

  const bufferRef = useRef<ReadingRow[]>([]);

  useEffect(() => {
    const ws = new WebSocket(resolveWsUrl());
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        const payload = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        const power = payload.avg_power ?? payload.power;
        const voltage = payload.avg_voltage ?? payload.voltage;
        const current = payload.avg_current ?? payload.current;
        const energyWh = payload.avg_energy_wh ?? payload.energy_wh ?? 0;
        if (typeof voltage !== 'number' || typeof power !== 'number') return;
        let tsNum = Number(payload.window_start ?? payload.timestamp);
        if (!Number.isFinite(tsNum)) tsNum = Date.now();
        if (tsNum < 1e12) tsNum = tsNum * 1000;
        const nodeId = String(payload.node_id ?? 'unknown');
        const row: ReadingRow = {
          nodeId, voltage, current: current ?? 0, power, energyWh, time: fmtTime(tsNum), ts: tsNum,
        };
        bufferRef.current.push(row);
        setNodes((prev) => !prev.includes(nodeId) ? [...prev, nodeId].sort() : prev);
        setHealthMap((prev) => ({
          ...prev,
          [nodeId]: {
            status: 'online',
            sequence_no: prev[nodeId]?.sequence_no ?? 0,
            uptime_sec: prev[nodeId]?.uptime_sec ?? 0,
            sensor_ok: prev[nodeId]?.sensor_ok ?? true,
            mqtt_connected: true,
            wifi_connected: true,
          },
        }));
      } catch { /* */ }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const batch = bufferRef.current.splice(0);
      setRows((prev) => [...batch, ...prev].slice(0, MAX_ROWS));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const dashboardTabs = useMemo(() => {
    const tabs = [
      { label: 'Overview', index: 0 },
      { label: 'Live Nodes', index: 1 },
      { label: 'Events', index: 2 },
    ];
    if (roles.includes('admin')) {
      tabs.push({ label: 'Admin', index: 3 });
    }
    return tabs;
  }, [roles]);

  return (
    <Shell 
      connected={connected} 
      tabs={dashboardTabs} 
      tabValue={tabIndex} 
      onTabChange={setTabIndex}
    >
      {tabIndex === 0 && <OverviewTab nodes={nodes} rows={rows} healthMap={healthMap} events={eventsMap} connected={connected} />}
      {tabIndex === 1 && <LiveNodesTab nodes={nodes} rows={rows} healthMap={healthMap} />}
      {tabIndex === 2 && <EventsTab events={eventsMap} nodes={nodes} />}
      {tabIndex === 3 && roles.includes('admin') && <AdminTab />}
    </Shell>
  );
}
