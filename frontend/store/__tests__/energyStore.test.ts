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
