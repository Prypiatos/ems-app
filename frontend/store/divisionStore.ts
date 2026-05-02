import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Division {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface DivisionHierarchyNode {
  id: string;
  children: string[];
}

interface DivisionStore {
  divisions: Division[];
  hierarchy: Record<string, DivisionHierarchyNode>;
  setDivisions: (divisions: Division[]) => void;
}

export const useDivisionStore = create<DivisionStore>()(
  devtools(
    (set) => ({
      divisions: [],
      hierarchy: {},
      setDivisions: (divisions) =>
        set(
          () => {
            const hierarchy = divisions.reduce<Record<string, DivisionHierarchyNode>>(
              (acc, division) => {
                acc[division.id] = acc[division.id] ?? {
                  id: division.id,
                  children: [],
                };

                const parentId = division.parentId ?? null;
                if (!parentId) return acc;

                acc[parentId] = acc[parentId] ?? { id: parentId, children: [] };
                if (!acc[parentId].children.includes(division.id)) {
                  acc[parentId].children.push(division.id);
                }

                return acc;
              },
              {}
            );

            return {
              divisions,
              hierarchy,
            };
          },
          false,
          'division/setDivisions'
        ),
    }),
    {
      name: 'division-store',
    }
  )
);
