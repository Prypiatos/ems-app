'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

const BACKEND_PORT = 8080;
const READINGS_WS_PATH = '/api/v1/readings';
const NODES_API_PATH = '/api/v1/nodes';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, ArcElement);

type IncomingReading = {
  node_id?: string;
  timestamp?: number;
  voltage?: number;
  current?: number;
  power?: number;
  energy_wh?: number;
  [key: string]: unknown;
};

type ReadingRow = {
  nodeId: string;
  voltage: number;
  current: number;
  power: number;
  energyWh: number;
  time: string;
};

type NodeEvent = {
  timestamp: number;
  event_type: string;
  severity: string;
  message: string;
};

type NodeHealth = {
  status: string;
  sequence_no: number;
  uptime_sec: number;
  sensor_ok: boolean;
  mqtt_connected: boolean;
  wifi_connected: boolean;
};

function resolveWsUrl(): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';

  if (typeof window === 'undefined') {
    return `${protocol}://localhost:${BACKEND_PORT}${READINGS_WS_PATH}`;
  }

  return `${protocol}://${window.location.hostname}:${BACKEND_PORT}${READINGS_WS_PATH}`;
}

function parseTimestamp(input: unknown): string {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const ms = input > 1_000_000_000_000 ? input : input * 1000;
    return new Date(ms).toLocaleTimeString();
  }
  return new Date().toLocaleTimeString();
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

export function RealtimeDashboard() {
  const [connected, setConnected] = useState(false);
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [events, setEvents] = useState<NodeEvent[]>([]);
  const [health, setHealth] = useState<NodeHealth | null>(null);
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('node_001');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return `http://localhost:${BACKEND_PORT}`;
    return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;
  }, []);

  const loadNodes = useCallback(async () => {
    const nodesRes = await fetch(`${baseUrl}${NODES_API_PATH}`);
    if (!nodesRes.ok) return;
    const nodeList = ((await nodesRes.json()) as string[]).slice().sort();
    if (nodeList.length > 0) {
      setNodes(nodeList);
      if (!nodeList.includes(selectedNode)) setSelectedNode(nodeList[0]);
    }
  }, [baseUrl, selectedNode]);

  const loadDetails = useCallback(async () => {
    const eventsPath = `/api/v1/nodes/${selectedNode}/events?limit=30`;
    const healthPath = `/api/v1/nodes/${selectedNode}/health`;
    const [eventsRes, healthRes] = await Promise.all([
      fetch(`${baseUrl}${eventsPath}`),
      fetch(`${baseUrl}${healthPath}`),
    ]);
    if (eventsRes.ok) setEvents((await eventsRes.json()) as NodeEvent[]);
    if (healthRes.ok) setHealth((await healthRes.json()) as NodeHealth);
  }, [baseUrl, selectedNode]);

  useEffect(() => {
    const ws = new WebSocket(resolveWsUrl());
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        const payload = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        const reading = payload as IncomingReading;
        if (
          typeof reading.voltage !== 'number' ||
          typeof reading.current !== 'number' ||
          typeof reading.power !== 'number' ||
          typeof reading.energy_wh !== 'number'
        ) return;

        const row: ReadingRow = {
          nodeId: String(reading.node_id ?? 'unknown'),
          voltage: reading.voltage,
          current: reading.current,
          power: reading.power,
          energyWh: reading.energy_wh,
          time: parseTimestamp(reading.timestamp),
        };
        setRows((prev) => [row, ...prev].slice(0, 120));
      } catch {
        // ignore malformed
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadNodes().catch(() => undefined);
      loadDetails().catch(() => undefined);
    });
    const timer = setInterval(() => {
      loadNodes().catch(() => undefined);
      loadDetails().catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadNodes, loadDetails]);

  const selectedRows = useMemo(() => rows.filter((r) => r.nodeId === selectedNode).slice(0, 30).reverse(), [rows, selectedNode]);
  const latest = selectedRows.length > 0 ? selectedRows[selectedRows.length - 1] : undefined;

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter((e) => e.event_type.toLowerCase().includes(q) || e.message.toLowerCase().includes(q));
  }, [events, search]);

  const lineData = useMemo(
    () => ({
      labels: selectedRows.map((r) => r.time),
      datasets: [
        {
          label: 'Power (kW)',
          data: selectedRows.map((r) => r.power),
          borderColor: '#00366d',
          backgroundColor: 'rgba(0,54,109,0.14)',
          borderWidth: 2.5,
          pointRadius: 2,
          tension: 0.35,
        },
        {
          label: 'Voltage (V)',
          data: selectedRows.map((r) => r.voltage),
          borderColor: '#d97706',
          backgroundColor: 'rgba(217,119,6,0.12)',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.35,
        },
      ],
    }),
    [selectedRows],
  );

  const severityCounts = useMemo(() => {
    const out = { high: 0, medium: 0, low: 0 };
    for (const e of filteredEvents) {
      if (e.severity === 'high') out.high += 1;
      else if (e.severity === 'medium') out.medium += 1;
      else out.low += 1;
    }
    return out;
  }, [filteredEvents]);

  const severityData = useMemo(
    () => ({
      labels: ['High', 'Medium', 'Low'],
      datasets: [
        {
          data: [severityCounts.high, severityCounts.medium, severityCounts.low],
          backgroundColor: ['#ba1a1a', '#f59e0b', '#00366d'],
          borderWidth: 0,
        },
      ],
    }),
    [severityCounts],
  );

  const nodeHealthScore = useMemo(() => {
    if (!health) return 0;
    let score = 40;
    if (health.status === 'online') score += 25;
    if (health.sensor_ok) score += 15;
    if (health.mqtt_connected) score += 10;
    if (health.wifi_connected) score += 10;
    return Math.min(100, score);
  }, [health]);

  const onLiveRefresh = async () => {
    await Promise.all([loadNodes(), loadDetails()]);
    setToast('Live data refreshed');
    setTimeout(() => setToast(''), 1800);
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNode}-events.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Event logs exported');
    setTimeout(() => setToast(''), 1800);
  };

  const onAddNode = () => {
    const id = window.prompt('Enter node ID (e.g. node_004):');
    if (!id) return;
    if (!nodes.includes(id)) setNodes((prev) => [...prev, id].sort());
    setSelectedNode(id);
    setToast(`Switched to ${id}`);
    setTimeout(() => setToast(''), 1800);
  };

  return (
    <div className="dashboardShell">
      <header className="topBar">
        <div className="topLeft">
          <span className="logoText">Energy Realtime</span>
          <nav className="topLinks">
            <button className="topLink active" type="button">Active Nodes</button>
            <button className="topLink" type="button">Dashboard</button>
            <button className="topLink" type="button">Configuration</button>
          </nav>
        </div>
        <div className="topRight">
          <span className={`connBadge ${connected ? 'up' : 'down'}`}>{connected ? 'Live' : 'Offline'}</span>
          <div className="searchBox">
            <span>Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search node telemetry..." />
          </div>
          <button className="iconBtn" type="button" onClick={() => setToast('No new notifications')}>Bell</button>
          <button className="iconBtn" type="button" onClick={() => setToast('Settings panel coming soon')}>Settings</button>
        </div>
      </header>

      <aside className="sideBar">
        <div className="sideHead">
          <h3>Energy Realtime</h3>
          <p>Enterprise Monitor</p>
        </div>
        <nav className="sideNav">
          <button className="sideItem" type="button">Dashboard</button>
          <button className="sideItem active" type="button">Active Nodes</button>
          <button className="sideItem" type="button">Configuration</button>
          <button className="sideItem" type="button">Event Logs</button>
        </nav>
        <button className="addNodeBtn" type="button" onClick={onAddNode}>Add New Node</button>
      </aside>

      <main className="mainCanvas">
        <div className="pageHead">
          <div>
            <p className="crumb">Nodes / {selectedNode}</p>
            <h1>Node Dashboard</h1>
          </div>
          <div className="headActions">
            <select className="nodeSelect" value={selectedNode} onChange={(e) => setSelectedNode(e.target.value)}>
              {nodes.length === 0 ? <option value={selectedNode}>{selectedNode}</option> : null}
              {nodes.map((node) => (
                <option key={node} value={node}>{node}</option>
              ))}
            </select>
            <button className="actionBtn" type="button" onClick={onExport}>Export Logs</button>
            <button className="actionBtn" type="button" onClick={onLiveRefresh}>Live Refresh</button>
          </div>
        </div>

        <section className="metricsRow">
          <article className="metricCard">
            <p>Node ID</p>
            <strong>{selectedNode}</strong>
          </article>
          <article className="metricCard">
            <p>Status</p>
            <strong className={health?.status === 'online' ? 'ok' : 'bad'}>{health?.status ?? 'unknown'}</strong>
            <small>Up: {formatUptime(health?.uptime_sec)}</small>
          </article>
          <article className="metricCard">
            <p>Latest Value</p>
            <strong>{latest ? `${latest.power.toFixed(1)} kW` : '-'}</strong>
          </article>
          <article className="metricCard">
            <p>Voltage</p>
            <strong>{latest ? `${latest.voltage.toFixed(1)} V` : '-'}</strong>
          </article>
          <article className="metricCard">
            <p>Node Health</p>
            <div className="progressTrack"><div className="progressFill" style={{ width: `${nodeHealthScore}%` }} /></div>
            <strong>{nodeHealthScore}%</strong>
          </article>
        </section>

        <section className="midGrid">
          <article className="trendCard">
            <div className="cardHead">
              <div>
                <h2>Telemetry Trend</h2>
                <p>Power Output vs Voltage Stability</p>
              </div>
            </div>
            {selectedRows.length === 0 ? <p className="empty">Waiting for telemetry...</p> : <Line data={lineData} />}
          </article>

          <article className="donutCard">
            <h2>Event Severity</h2>
            <p>Total node events ({selectedNode})</p>
            {filteredEvents.length === 0 ? <p className="empty">No events yet</p> : <Doughnut data={severityData} />}
            <div className="donutLegend">
              <div><span className="dot high" />High: {severityCounts.high}</div>
              <div><span className="dot med" />Medium: {severityCounts.medium}</div>
              <div><span className="dot low" />Low: {severityCounts.low}</div>
            </div>
          </article>
        </section>

        <section className="eventsCard">
          <div className="eventsHeader">
            <div>
              <h2>Recent Events</h2>
              <p>Audit trail of system actions</p>
            </div>
            <button className="linkBtn" type="button" onClick={onExport}>View All History</button>
          </div>

          {filteredEvents.length === 0 ? (
            <p className="empty">No events yet</p>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Code</th>
                    <th>Description</th>
                    <th>Severity</th>
                    <th>Action Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event, idx) => (
                    <tr key={`${event.timestamp}-${idx}`}>
                      <td>{parseTimestamp(event.timestamp)}</td>
                      <td>{event.event_type}</td>
                      <td>{event.message}</td>
                      <td><span className={`pill ${event.severity}`}>{event.severity}</span></td>
                      <td>{event.severity === 'high' ? 'Escalated' : event.severity === 'medium' ? 'Self-corrected' : 'Logged'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="footer">
          <p>© 2024 Energy Realtime. Secure Telemetry Infrastructure.</p>
          <div>
            <button type="button">Terms</button>
            <button type="button">Privacy</button>
            <button type="button">Compliance</button>
          </div>
        </footer>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
