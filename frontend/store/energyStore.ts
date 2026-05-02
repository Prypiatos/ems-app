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
          (state) => ({
            readings: [...state.readings, reading],
            latestByDivision: {
              ...state.latestByDivision,
              [reading.divisionId]: reading,
            },
          }),
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
