import { beforeEach, describe, expect, it } from 'vitest';
import { useAlertStore } from '../alertStore';

describe('alertStore', () => {
  beforeEach(() => {
    useAlertStore.setState({ alerts: [], unreadCount: 0 });
  });

  it('initializes with empty state', () => {
    const state = useAlertStore.getState();
    expect(state.alerts).toEqual([]);
    expect(state.unreadCount).toBe(0);
  });

  it('adds new alerts and updates unreadCount', () => {
    useAlertStore.getState().addAlert({
      id: 'a1',
      node_id: 'n-01',
      type: 'high_usage',
      severity: 'warning',
      timestamp: 1710000000,
      message: 'High usage',
    });

    const state = useAlertStore.getState();
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0].status).toBe('new');
    expect(state.unreadCount).toBe(1);
  });

  it('acknowledges alert and decreases unreadCount', () => {
    useAlertStore.getState().addAlert({
      id: 'a1',
      node_id: 'n-01',
      type: 'high_usage',
      severity: 'warning',
      timestamp: 1710000000,
      message: 'High usage',
    });

    useAlertStore.getState().acknowledge('a1');

    const state = useAlertStore.getState();
    expect(state.alerts[0].status).toBe('acknowledged');
    expect(state.unreadCount).toBe(0);
  });

  it('resolves alert and decreases unreadCount when needed', () => {
    useAlertStore.getState().addAlert({
      id: 'a1',
      node_id: 'n-01',
      type: 'high_usage',
      severity: 'warning',
      timestamp: 1710000000,
      message: 'High usage',
    });

    useAlertStore.getState().resolve('a1');

    const state = useAlertStore.getState();
    expect(state.alerts[0].status).toBe('resolved');
    expect(state.unreadCount).toBe(0);
  });
});
