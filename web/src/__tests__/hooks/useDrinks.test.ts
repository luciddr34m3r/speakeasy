import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
  messaging: null,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('react-firebase-hooks/firestore', () => ({
  useCollection: vi.fn(),
}));

import { useCollection } from 'react-firebase-hooks/firestore';
import { useDrinks } from '../../hooks/useDrinks';
import type { Drink } from '../../lib/schema';

const mockUseCollection = vi.mocked(useCollection);

function makeSnapshot(docs: Array<{ id: string; data: Partial<Drink> }>): QuerySnapshot<DocumentData> {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
  } as unknown as QuerySnapshot<DocumentData>;
}

describe('useDrinks', () => {
  beforeEach(() => {
    mockUseCollection.mockReset();
  });

  it('returns empty array when snapshot is empty', () => {
    mockUseCollection.mockReturnValue([makeSnapshot([]), false, undefined]);
    const { result } = renderHook(() => useDrinks());
    expect(result.current.drinks).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('maps docs to Drink objects with injected id', () => {
    mockUseCollection.mockReturnValue([
      makeSnapshot([
        { id: 'drink-1', data: { name: 'Negroni', available: true, ingredients: ['gin', 'vermouth'], category: 'Cocktails', description: '' } },
        { id: 'drink-2', data: { name: 'Spritz', available: true, ingredients: ['prosecco'], category: 'Bubbles', description: '' } },
      ]),
      false,
      undefined,
    ]);

    const { result } = renderHook(() => useDrinks());
    expect(result.current.drinks).toHaveLength(2);
    expect(result.current.drinks[0].id).toBe('drink-1');
    expect(result.current.drinks[0].name).toBe('Negroni');
    expect(result.current.drinks[1].id).toBe('drink-2');
  });

  it('returns loading true while fetching', () => {
    mockUseCollection.mockReturnValue([undefined, true, undefined]);
    const { result } = renderHook(() => useDrinks());
    expect(result.current.loading).toBe(true);
    expect(result.current.drinks).toEqual([]);
  });

  it('handles undefined snapshot gracefully', () => {
    mockUseCollection.mockReturnValue([undefined, false, undefined]);
    const { result } = renderHook(() => useDrinks());
    expect(result.current.drinks).toEqual([]);
  });
});
