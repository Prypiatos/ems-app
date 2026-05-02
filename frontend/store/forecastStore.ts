import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ForecastPoint {
  timestamp: string;
  value: number;
}

interface ForecastStore {
  forecasts: Record<string, ForecastPoint[]>;
  setForecast: (divisionId: string, points: ForecastPoint[]) => void;
  clearForecast: () => void;
}

export const useForecastStore = create<ForecastStore>()(
  devtools(
    (set) => ({
      forecasts: {},
      setForecast: (divisionId, points) =>
        set(
          (state) => ({
            forecasts: {
              ...state.forecasts,
              [divisionId]: points,
            },
          }),
          false,
          'forecast/setForecast'
        ),
      clearForecast: () =>
        set(
          {
            forecasts: {},
          },
          false,
          'forecast/clearForecast'
        ),
    }),
    {
      name: 'forecast-store',
    }
  )
);
