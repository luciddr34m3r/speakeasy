import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAssertAdmin, mockInviteSet, mockInviteGet, mockInviteDelete, mockConfigUpdate, mockUserSet } = vi.hoisted(() => ({
  mockAssertAdmin: vi.fn(),
  mockInviteSet: vi.fn(),
  mockInviteGet: vi.fn(),
  mockInviteDelete: vi.fn(),
  mockConfigUpdate: vi.fn(),
  mockUserSet: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = () => ({
    doc: (path: string) => {
      if (path === 'config/bartenderInvite') {
        return { set: mockInviteSet, get: mockInviteGet, delete: mockInviteDelete };
      }
      if (path === 'config/app') return { update: mockConfigUpdate };
      if (path.startsWith('users/')) return { set: mockUserSet };
      throw new Error(`unexpected doc: ${path}`);
    },
  });
  return {
    default: { apps: ['app'], firestore, initializeApp: vi.fn() },
    apps: ['app'],
    firestore,
    initializeApp: vi.fn(),
  };
});

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    arrayUnion: (...v: string[]) => ({ ARRAY_UNION: v }),
  },
  Timestamp: {
    fromMillis: (ms: number) => ({ toMillis: () => ms }),
  },
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((handler) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

vi.mock('../lib/adminGuard', () => ({ assertAdmin: mockAssertAdmin }));

import { createBartenderInviteHandler, claimBartenderInviteHandler } from '../bartenderInvites';
import type { CallableRequest } from 'firebase-functions/v2/https';

function makeClaimRequest(code: unknown, provider = 'google.com', auth: object | null = {}, name?: string) {
  return {
    auth: auth === null ? undefined : {
      uid: 'bartender-uid',
      token: { firebase: { sign_in_provider: provider }, name: 'Jenn', email: 'jenn@example.com' },
      ...auth,
    },
    data: { code, ...(name !== undefined ? { name } : {}) },
  } as unknown as CallableRequest<{ code: string; name?: string }>;
}

describe('createBartenderInviteHandler', () => {
  beforeEach(() => {
    mockAssertAdmin.mockReset().mockResolvedValue(undefined);
    mockInviteSet.mockReset().mockResolvedValue(undefined);
  });

  it('requires the admin', async () => {
    await createBartenderInviteHandler({ auth: { uid: 'a' } } as unknown as CallableRequest);
    expect(mockAssertAdmin).toHaveBeenCalledOnce();
  });

  it('writes a 6-char unambiguous code with an expiry and returns it', async () => {
    const result = await createBartenderInviteHandler({ auth: { uid: 'a' } } as unknown as CallableRequest);

    expect(result.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    const written = mockInviteSet.mock.calls[0][0];
    expect(written.code).toBe(result.code);
    expect(written.expiresAt.toMillis()).toBe(result.expiresAt);
  });
});

describe('claimBartenderInviteHandler', () => {
  beforeEach(() => {
    mockInviteGet.mockReset().mockResolvedValue({
      exists: true,
      data: () => ({ code: 'ABC234', expiresAt: { toMillis: () => Date.now() + 60_000 } }),
    });
    mockInviteDelete.mockReset().mockResolvedValue(undefined);
    mockConfigUpdate.mockReset().mockResolvedValue(undefined);
    mockUserSet.mockReset().mockResolvedValue(undefined);
  });

  it('rejects unauthenticated calls', async () => {
    await expect(claimBartenderInviteHandler(makeClaimRequest('ABC234', 'google.com', null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects anonymous users', async () => {
    await expect(claimBartenderInviteHandler(makeClaimRequest('ABC234', 'anonymous'))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('rejects wrong codes', async () => {
    await expect(claimBartenderInviteHandler(makeClaimRequest('WRONG1'))).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('rejects expired invites', async () => {
    mockInviteGet.mockResolvedValue({
      exists: true,
      data: () => ({ code: 'ABC234', expiresAt: { toMillis: () => Date.now() - 1000 } }),
    });
    await expect(claimBartenderInviteHandler(makeClaimRequest('ABC234'))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('adds the bartender, records their name, and burns the invite (case-insensitive)', async () => {
    const result = await claimBartenderInviteHandler(makeClaimRequest('abc234'));

    expect(result).toEqual({ ok: true });
    expect(mockConfigUpdate).toHaveBeenCalledWith({
      bartenderUids: { ARRAY_UNION: ['bartender-uid'] },
      'bartenderNames.bartender-uid': 'Jenn',
    });
    expect(mockUserSet).toHaveBeenCalledWith({ displayName: 'Jenn' }, { merge: true });
    expect(mockInviteDelete).toHaveBeenCalledOnce();
  });

  it('prefers an explicitly provided name over the Google profile', async () => {
    await claimBartenderInviteHandler(makeClaimRequest('ABC234', 'google.com', {}, '  Jenny B  '));
    expect(mockConfigUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'bartenderNames.bartender-uid': 'Jenny B' }),
    );
    expect(mockUserSet).toHaveBeenCalledWith({ displayName: 'Jenny B' }, { merge: true });
  });

  it('rejects names over 40 characters', async () => {
    await expect(
      claimBartenderInviteHandler(makeClaimRequest('ABC234', 'google.com', {}, 'x'.repeat(41))),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
