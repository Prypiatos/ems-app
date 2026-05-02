'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useEnergyStore, type EnergyReading } from '@/store/energyStore';

export type RealtimeConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface RealtimeEnergyConnectionOptions {
  divisionId: string;
  onReading: (reading: EnergyReading) => void;
  onStateChange: (state: RealtimeConnectionState) => void;
  baseUrl?: string;
}

const BACKOFF_STEPS_MS = [1000, 2000, 4000];
const MAX_BACKOFF_MS = 30000;

export function createRealtimeEnergyConnection({
  divisionId,
  onReading,
  onStateChange,
  baseUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8000',
}: RealtimeEnergyConnectionOptions) {
  let socket: Socket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let stopped = false;

  const room = `division:${divisionId}`;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const computeBackoff = () => {
    if (reconnectAttempt < BACKOFF_STEPS_MS.length) return BACKOFF_STEPS_MS[reconnectAttempt];
    const doubled = BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1] * 2 ** (reconnectAttempt - 2);
    return Math.min(doubled, MAX_BACKOFF_MS);
  };

  const connect = () => {
    if (stopped) return;

    onStateChange('connecting');
    socket = io(`${baseUrl}/realtime/readings`, {
      reconnection: false,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      reconnectAttempt = 0;
      onStateChange('connected');
      socket?.emit('join', room);
    });

    socket.on('reading:update', (reading: EnergyReading) => {
      onReading(reading);
    });

    socket.on('disconnect', () => {
      if (stopped) return;
      onStateChange('disconnected');
      clearReconnectTimer();

      const delay = computeBackoff();
      reconnectAttempt += 1;

      reconnectTimer = setTimeout(() => {
        connect();
      }, delay);
    });

    socket.on('connect_error', () => {
      if (stopped) return;
      onStateChange('error');
    });
  };

  connect();

  const stop = () => {
    stopped = true;
    clearReconnectTimer();

    if (socket) {
      socket.emit('leave', room);
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    onStateChange('disconnected');
  };

  return {
    stop,
  };
}

export function useRealtimeEnergy(divisionId: string) {
  const addReading = useEnergyStore((state) => state.addReading);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('disconnected');
  const connectionRef = useRef<ReturnType<typeof createRealtimeEnergyConnection> | null>(null);

  useEffect(() => {
    if (!divisionId) {
      setConnectionState('error');
      return;
    }

    connectionRef.current = createRealtimeEnergyConnection({
      divisionId,
      onReading: addReading,
      onStateChange: setConnectionState,
    });

    return () => {
      connectionRef.current?.stop();
      connectionRef.current = null;
    };
  }, [divisionId, addReading]);

  return {
    connectionState,
  };
}
