import { beforeEach, describe, expect, it } from 'vitest';
import { useDivisionStore } from '../divisionStore';

describe('divisionStore', () => {
  beforeEach(() => {
    useDivisionStore.setState({ divisions: [], hierarchy: {} });
  });

  it('initializes with empty state', () => {
    const state = useDivisionStore.getState();
    expect(state.divisions).toEqual([]);
    expect(state.hierarchy).toEqual({});
  });

  it('sets divisions and builds hierarchy', () => {
    useDivisionStore.getState().setDivisions([
      { id: 'root', name: 'Root', parentId: null },
      { id: 'child-1', name: 'Child 1', parentId: 'root' },
      { id: 'child-2', name: 'Child 2', parentId: 'root' },
    ]);

    const state = useDivisionStore.getState();
    expect(state.divisions).toHaveLength(3);
    expect(state.hierarchy.root?.children).toEqual(['child-1', 'child-2']);
  });
});
