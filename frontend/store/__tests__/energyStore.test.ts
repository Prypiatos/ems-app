import { beforeEach, describe, expect, it } from 'vitest';
import { useEnergyStore } from '../energyStore';

describe('energyStore', () => {
  beforeEach(() => {
    useEnergyStore.setState({ readings: [], latestByDivision: {} });
  });

  it('initializes with empty state', () => {
    const state = useEnergyStore.getState();
    expect(state.readings).toEqual([]);
    expect(state.latestByDivision).toEqual({});
  });

  it('adds a reading and updates latestByDivision', () => {
    useEnergyStore.getState().addReading({
      divisionId: 'd1',
      value: 120,
      timestamp: '2026-05-02T12:00:00.000Z',
    });

    const state = useEnergyStore.getState();
    expect(state.readings).toHaveLength(1);
    expect(state.latestByDivision.d1?.value).toBe(120);
  });

  it('keeps the newest reading in latestByDivision when an older reading arrives later', () => {
    useEnergyStore.getState().addReading({
      divisionId: 'd1',
      value: 120,
      timestamp: '2026-05-02T12:00:00.000Z',
    });
    useEnergyStore.getState().addReading({
      divisionId: 'd1',
      value: 90,
      timestamp: '2026-05-02T11:00:00.000Z',
    });

    const state = useEnergyStore.getState();
    expect(state.readings).toHaveLength(2);
    expect(state.latestByDivision.d1?.value).toBe(120);
    expect(state.latestByDivision.d1?.timestamp).toBe('2026-05-02T12:00:00.000Z');
  });

  it('clears readings and latestByDivision', () => {
    useEnergyStore.getState().addReading({
      divisionId: 'd1',
      value: 120,
      timestamp: '2026-05-02T12:00:00.000Z',
    });

    useEnergyStore.getState().clearReadings();

    const state = useEnergyStore.getState();
    expect(state.readings).toEqual([]);
    expect(state.latestByDivision).toEqual({});
  });
});
