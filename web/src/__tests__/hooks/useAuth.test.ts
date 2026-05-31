import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User } from 'firebase/auth';

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
  messaging: null,
}));

vi.mock('react-firebase-hooks/auth', () => ({
  useAuthState: vi.fn(),
}));

import { useAuthState } from 'react-firebase-hooks/auth';
import { useAuth } from '../../hooks/useAuth';

const mockUseAuthState = vi.mocked(useAuthState);

describe('useAuth', () => {
  beforeEach(() => {
    mockUseAuthState.mockReset();
  });

  it('returns user and loading false when signed in', () => {
    const fakeUser = { uid: 'abc', isAnonymous: false } as User;
    mockUseAuthState.mockReturnValue([fakeUser, false, undefined]);

    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBe(fakeUser);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('returns loading true while auth resolves', () => {
    mockUseAuthState.mockReturnValue([undefined, true, undefined]);

    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeUndefined();
  });

  it('returns null user when signed out', () => {
    mockUseAuthState.mockReturnValue([null, false, undefined]);

    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('surfaces auth errors', () => {
    const err = new Error('auth failed');
    mockUseAuthState.mockReturnValue([undefined, false, err]);

    const { result } = renderHook(() => useAuth());
    expect(result.current.error).toBe(err);
  });
});
