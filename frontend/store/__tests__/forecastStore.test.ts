import { beforeEach, describe, expect, it } from 'vitest';
import { useForecastStore } from '../forecastStore';

describe('forecastStore', () => {
  beforeEach(() => {
    useForecastStore.setState({ forecasts: {} });
  });

  it('initializes with empty forecasts', () => {
    expect(useForecastStore.getState().forecasts).toEqual({});
  });

  it('sets forecast for a division', () => {
    useForecastStore.getState().setForecast('d1', [
      { timestamp: '2026-05-02T12:00:00.000Z', value: 100 },
      { timestamp: '2026-05-02T13:00:00.000Z', value: 110 },
    ]);

    expect(useForecastStore.getState().forecasts.d1).toHaveLength(2);
  });

  it('clears all forecasts', () => {
    useForecastStore.getState().setForecast('d1', [
      { timestamp: '2026-05-02T12:00:00.000Z', value: 100 },
    ]);

    useForecastStore.getState().clearAllForecasts();

    expect(useForecastStore.getState().forecasts).toEqual({});
  });
});
