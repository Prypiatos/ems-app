import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnergyStore } from '@/store/energyStore';

const sockets: MockSocket[] = [];

class MockSocket {
  private handlers = new Map<string, Array<(...args: any[]) => void>>();
  public emitted: Array<{ event: string; payload: unknown }> = [];
  public disconnected = false;

  on(event: string, cb: (...args: any[]) => void) {
    const existing = this.handlers.get(event) ?? [];
    existing.push(cb);
    this.handlers.set(event, existing);
    return this;
  }

  emit(event: string, payload?: unknown) {
    this.emitted.push({ event, payload });
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  disconnect() {
    this.disconnected = true;
    return this;
  }

  trigger(event: string, payload?: unknown) {
    const list = this.handlers.get(event) ?? [];
    list.forEach((cb) => cb(payload));
  }
}

vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => {
      const socket = new MockSocket();
      sockets.push(socket);
      return socket;
    }),
  };
});

import { createRealtimeEnergyConnection } from '../useRealtimeEnergy';

describe('createRealtimeEnergyConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sockets.length = 0;
    useEnergyStore.setState({ readings: [], latestByDivision: {} });
  });

  it('joins correct room on connect and updates store on reading:update', () => {
    const states: string[] = [];

    createRealtimeEnergyConnection({
      divisionId: 'div-1',
      onReading: useEnergyStore.getState().addReading,
      onStateChange: (state) => states.push(state),
      baseUrl: 'http://localhost:8000',
    });

    const socket = sockets[0];
    socket.trigger('connect');

    expect(socket.emitted).toContainEqual({
      event: 'join',
      payload: 'division:div-1',
    });

    socket.trigger('reading:update', {
      divisionId: 'div-1',
      value: 42,
      timestamp: '2026-05-02T12:00:00.000Z',
    });

    const store = useEnergyStore.getState();
    expect(store.readings).toHaveLength(1);
    expect(store.latestByDivision['div-1']?.value).toBe(42);
    expect(states).toContain('connected');
  });

  it('reconnects with exponential backoff after disconnect', () => {
    const states: string[] = [];

    createRealtimeEnergyConnection({
      divisionId: 'div-1',
      onReading: useEnergyStore.getState().addReading,
      onStateChange: (state) => states.push(state),
      baseUrl: 'http://localhost:8000',
    });

    sockets[0].trigger('disconnect');
    expect(states).toContain('disconnected');

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    sockets[1].trigger('disconnect');
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(3);
  });

  it('leaves room and disconnects on stop without reconnecting', () => {
    const states: string[] = [];

    const conn = createRealtimeEnergyConnection({
      divisionId: 'div-2',
      onReading: useEnergyStore.getState().addReading,
      onStateChange: (state) => states.push(state),
      baseUrl: 'http://localhost:8000',
    });

    const socket = sockets[0];
    conn.stop();

    expect(socket.emitted).toContainEqual({
      event: 'leave',
      payload: 'division:div-2',
    });
    expect(socket.disconnected).toBe(true);

    socket.trigger('disconnect');
    vi.advanceTimersByTime(30000);
    expect(sockets).toHaveLength(1);
    expect(states.at(-1)).toBe('disconnected');
  });
});
