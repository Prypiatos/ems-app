import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface EnergyReading {
  divisionId: string;
  value: number;
  timestamp: string;
}

interface EnergyStore {
  readings: EnergyReading[];
  latestByDivision: Record<string, EnergyReading>;
  addReading: (reading: EnergyReading) => void;
  clearReadings: () => void;
}

export const useEnergyStore = create<EnergyStore>()(
  devtools(
    (set) => ({
      readings: [],
      latestByDivision: {},
      addReading: (reading) =>
        set(
          (state) => {
            const currentLatest = state.latestByDivision[reading.divisionId];
            const shouldReplaceLatest =
              !currentLatest ||
              Date.parse(reading.timestamp) >= Date.parse(currentLatest.timestamp);

            return {
              readings: [...state.readings, reading],
              latestByDivision: shouldReplaceLatest
                ? {
                    ...state.latestByDivision,
                    [reading.divisionId]: reading,
                  }
                : state.latestByDivision,
            };
          },
          false,
          'energy/addReading'
        ),
      clearReadings: () =>
        set(
          {
            readings: [],
            latestByDivision: {},
          },
          false,
          'energy/clearReadings'
        ),
    }),
    {
      name: 'energy-store',
    }
  )
);
