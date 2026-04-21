"use client";

import { useEffect, useState, useRef } from 'react';

interface Reading {
  node_id: string;
  value: number;
  timestamp: number;
}

export function LiveMonitor() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket via Kong Gateway
    const socket = new WebSocket('ws://localhost:8000/api/ws');
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      // Subscribe to readings topic
      socket.send(JSON.stringify({
        action: 'subscribe',
        topic: 'readings'
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.topic === 'readings' && msg.data) {
          // The data is a raw JSON message from Kafka
          const reading: Reading = msg.data;
          setReadings(prev => {
            const newReadings = [...prev, reading];
            // Keep only last 20 readings
            if (newReadings.length > 20) return newReadings.slice(newReadings.length - 20);
            return newReadings;
          });
        }
      } catch (err) {
        console.error("WS Message Error:", err);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border-subtle bg-panel p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold">Live Energy Monitor</h3>
          <p className="text-xs text-muted">Real-time throughput from active sensors</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
            {connected ? 'Live Stream' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="h-48 flex items-end gap-1 px-2">
        {readings.length === 0 ? (
          <div className="flex flex-1 items-center justify-center h-full border border-dashed border-border-subtle rounded-xl">
            <p className="text-xs text-muted italic">Waiting for incoming data stream...</p>
          </div>
        ) : (
          readings.map((r, i) => {
            // Simple normalization for visualization (assuming max 100 for now)
            const height = Math.min((r.value / 100) * 100, 100);
            return (
              <div 
                key={i} 
                className="flex-1 bg-accent rounded-t-sm transition-all duration-300 group relative"
                style={{ height: `${height}%` }}
              >
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                  <div className="bg-fg text-bg text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap font-bold">
                    {r.value} kWh - {r.node_id}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <div className="text-[10px] text-muted font-medium uppercase tracking-tighter">Older</div>
        <div className="text-[10px] text-muted font-medium uppercase tracking-tighter">Newest</div>
      </div>
    </div>
  );
}
