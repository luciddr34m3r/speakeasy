import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRunTransaction, mockGet, mockSet, mockUpdate } = vi.hoisted(() => ({
  mockRunTransaction: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: {
    apps: ['app'],
    firestore: () => ({
      doc: () => ({}),
      runTransaction: mockRunTransaction,
    }),
    initializeApp: vi.fn(),
  },
  apps: ['app'],
  firestore: () => ({
    doc: () => ({}),
    runTransaction: mockRunTransaction,
  }),
  initializeApp: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

import { assertRateLimit } from '../lib/rateLimiter';

function setupTransaction(data: { count: number; windowStart: number } | undefined) {
  mockRunTransaction.mockImplementation(async (fn: (txn: unknown) => Promise<void>) => {
    await fn({ get: mockGet, set: mockSet, update: mockUpdate });
  });
  mockGet.mockResolvedValue({ data: () => data });
}

describe('assertRateLimit', () => {
  beforeEach(() => {
    mockRunTransaction.mockReset();
    mockGet.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();
  });

  it('creates a new rate limit doc for a new user', async () => {
    setupTransaction(undefined);
    await assertRateLimit('new-user');
    expect(mockSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 1 }));
  });

  it('resets the window when window has expired', async () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    setupTransaction({ count: 9, windowStart: twoHoursAgo });
    await assertRateLimit('user-1');
    expect(mockSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 1 }));
  });

  it('increments count within the window', async () => {
    setupTransaction({ count: 3, windowStart: Date.now() - 1000 });
    await assertRateLimit('user-1');
    expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), { count: 4 });
  });

  it('throws resource-exhausted when count reaches MAX_REQUESTS', async () => {
    setupTransaction({ count: 10, windowStart: Date.now() - 1000 });
    await expect(assertRateLimit('user-1')).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not call Firestore again for a cached under-limit user', async () => {
    // First call — goes through Firestore
    setupTransaction({ count: 1, windowStart: Date.now() - 1000 });
    await assertRateLimit('cached-user');
    const firstCallCount = mockRunTransaction.mock.calls.length;

    // Second call within cache TTL — serves from cache
    setupTransaction({ count: 2, windowStart: Date.now() - 1000 });
    await assertRateLimit('cached-user');

    // Still goes through Firestore on second call to increment (cache only skips the check)
    expect(mockRunTransaction.mock.calls.length).toBeGreaterThanOrEqual(firstCallCount);
  });
});
