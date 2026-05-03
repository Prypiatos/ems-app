"use client";

import { useEffect, useState, useRef } from 'react';
import { LiveLineChart } from '@/app/components/charts/LiveLineChart';

interface Reading {
  node_id: string;
  division_id?: string;
  value: number;
  timestamp: number; // epoch ms
}

function toNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveWsUrl() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'ws://localhost:8000/api/readings';
  }

  const envUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL;
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  if (!envUrl) {
    return `${wsProtocol}://${window.location.hostname}:8000/api/readings`;
  }

  try {
    const parsed = new URL(envUrl);
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      parsed.hostname = window.location.hostname;
      return parsed.toString();
    }
    return envUrl;
  } catch {
    return envUrl;
  }
}

export function LiveMonitor() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = resolveWsUrl();

    // Backend currently exposes raw websocket readings at /readings.
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string);
        // Support both raw payloads and wrapped payloads like { topic, data }.
        const msg = typeof parsed?.data === 'object' && parsed.data !== null ? parsed.data : parsed;

        const rawValue =
          toNumber(msg.value) ??
          toNumber(msg.kwh) ??
          toNumber(msg.power_w) ??
          toNumber(msg.power) ??
          toNumber(msg.energy);
        if (rawValue == null) return;

        const timestampMs =
          toNumber(msg.ts_ms) ??
          (toNumber(msg.timestamp) != null ? (toNumber(msg.timestamp) as number) * 1000 : null) ??
          new Date(msg.timestamp ?? msg.created_at ?? msg.time).getTime();

        if (!Number.isFinite(timestampMs)) return;

        const reading: Reading = {
          node_id: String(msg.node_id ?? msg.nodeId ?? msg.device_id ?? 'unknown'),
          division_id:
            typeof msg.division_id === 'string'
              ? msg.division_id
              : typeof msg.divisionId === 'string'
                ? msg.divisionId
                : undefined,
          value: rawValue,
          timestamp: timestampMs,
        };

        setReadings((prev) => {
          const next = [...prev, reading];
          return next.length > 120 ? next.slice(next.length - 120) : next;
        });
      } catch (err) {
        console.error("WS Message Error:", err);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    return () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, []);

  const availableNodes = Array.from(new Set(readings.map((r) => r.node_id))).sort();
  const filteredReadings =
    selectedNode === 'all' ? readings : readings.filter((reading) => reading.node_id === selectedNode);

  const latest = filteredReadings[filteredReadings.length - 1];
  const latestValue = latest ? `${latest.value.toFixed(2)}` : '-';
  const latestNode = selectedNode === 'all' ? latest?.node_id ?? '-' : selectedNode;
  const latestAt = latest ? new Date(latest.timestamp).toLocaleTimeString() : '-';

  const oneMinuteAgo = Date.now() - 60_000;
  const readingsPerMinute = filteredReadings.filter((r) => r.timestamp >= oneMinuteAgo).length;
  const recentReadings = filteredReadings.slice(-8).reverse();
  const rollingAvg =
    filteredReadings.length > 0
      ? (filteredReadings.reduce((acc, item) => acc + item.value, 0) / filteredReadings.length).toFixed(2)
      : '-';
  const previous = filteredReadings.length > 1 ? filteredReadings[filteredReadings.length - 2] : null;
  const delta = latest && previous ? latest.value - previous.value : null;

  return (
    <div className="rounded-2xl border border-border-subtle bg-panel/95 p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold leading-tight">Live Energy Monitor</h3>
          <p className="text-xs text-muted">Real-time throughput from active sensors</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Node</label>
          <select
            value={selectedNode}
            onChange={(e) => setSelectedNode(e.target.value)}
            className="rounded-md border border-border-subtle bg-panel px-2 py-1 text-xs"
          >
            <option value="all">All</option>
            {availableNodes.map((node) => (
              <option key={node} value={node}>
                {node}
              </option>
            ))}
          </select>
          <div
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
              connected ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
            }`}
          >
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-border-subtle bg-panel/60 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Current Reading</p>
            <p className="mt-1 text-3xl font-bold leading-none">
              {latestValue}
              <span className="ml-1 text-sm font-semibold text-muted">kWh</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Delta</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                delta == null ? 'text-muted' : delta >= 0 ? 'text-emerald-600' : 'text-orange-600'
              }`}
            >
              {delta == null ? '-' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} kWh`}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-border-subtle bg-panel/60 p-3">
          <p className="text-muted uppercase tracking-wide">Node</p>
          <p className="mt-1 font-semibold">{latestNode}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-panel/60 p-3">
          <p className="text-muted uppercase tracking-wide">Per Minute</p>
          <p className="mt-1 font-semibold">{readingsPerMinute}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-panel/60 p-3">
          <p className="text-muted uppercase tracking-wide">Avg Window</p>
          <p className="mt-1 font-semibold">{rollingAvg === '-' ? '-' : `${rollingAvg} kWh`}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-panel/60 p-3">
          <p className="text-muted uppercase tracking-wide">Last Update</p>
          <p className="mt-1 font-semibold">{latestAt}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border-subtle bg-panel/60 p-3">
          {filteredReadings.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border-subtle">
              <p className="text-xs text-muted italic">
                {selectedNode === 'all'
                  ? 'Waiting for incoming data stream...'
                  : `No readings yet for ${selectedNode}.`}
              </p>
            </div>
          ) : (
            <LiveLineChart
              data={filteredReadings.map((r) => ({ timestamp: r.timestamp, value: r.value }))}
              windowSeconds={300}
              label={selectedNode === 'all' ? 'Live energy readings' : `${selectedNode} readings`}
            />
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-panel/60 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">Recent Events</p>
          {recentReadings.length === 0 ? (
            <p className="text-xs text-muted">No events yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentReadings.map((r, idx) => (
                <div
                  key={`${r.node_id}-${r.timestamp}-${idx}`}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border-subtle/70 px-2 py-1.5 text-xs"
                >
                  <div>
                    <p className="font-medium">{r.node_id}</p>
                    <p className="text-[10px] text-muted">{new Date(r.timestamp).toLocaleTimeString()}</p>
                  </div>
                  <p className="self-center font-semibold">{r.value.toFixed(2)} kWh</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-tighter text-muted">
        <div>Older</div>
        <div>Newest</div>
      </div>
      {!connected && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Live stream is disconnected. Check backend and websocket URL, then refresh.
        </div>
      )}
    </div>
  );
}
