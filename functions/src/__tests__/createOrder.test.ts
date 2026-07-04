import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConfigGet, mockPrivateGet, mockDrinkGet, mockOrderAdd, mockOrdersGet, mockUserSet } = vi.hoisted(() => ({
  mockConfigGet: vi.fn(),
  mockPrivateGet: vi.fn(),
  mockDrinkGet: vi.fn(),
  mockOrderAdd: vi.fn(),
  mockOrdersGet: vi.fn(),
  mockUserSet: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = () => ({
    doc: (path: string) => {
      if (path === 'config/app') return { get: mockConfigGet };
      if (path === 'config/private') return { get: mockPrivateGet };
      if (path.startsWith('drinks/')) return { get: mockDrinkGet };
      if (path.startsWith('users/')) return { set: mockUserSet };
      throw new Error(`unexpected doc path: ${path}`);
    },
    collection: () => ({
      add: mockOrderAdd,
      where: () => ({ orderBy: () => ({ limit: () => ({ get: mockOrdersGet }) }) }),
    }),
  });
  return {
    default: { apps: ['app'], firestore, initializeApp: vi.fn() },
    apps: ['app'],
    firestore,
    initializeApp: vi.fn(),
  };
});

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
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

import { createOrderHandler, normalizePassword } from '../createOrder';
import type { CallableRequest } from 'firebase-functions/v2/https';

type OrderData = { drinkId?: string; guestName?: string; password?: string; note?: string };

function makeRequest(data: OrderData, auth: { uid: string } | null = { uid: 'guest-uid' }) {
  return {
    auth: auth ? { uid: auth.uid, token: { firebase: { sign_in_provider: 'anonymous' } } } : undefined,
    data,
    rawRequest: {},
    acceptsStreaming: false,
  } as unknown as CallableRequest<never>;
}

function openBarConfig(overrides: Record<string, unknown> = {}) {
  return {
    data: () => ({
      barOpen: true,
      partyMode: false,
      adminUid: 'admin-uid',
      ...overrides,
    }),
  };
}

function ordersSnapshot(orders: Array<{ status: string; ageMs?: number }>) {
  const now = Date.now();
  return {
    docs: orders.map((o) => ({
      data: () => ({ status: o.status, createdAt: { toMillis: () => now - (o.ageMs ?? 0) } }),
    })),
  };
}

const availableDrink = {
  exists: true,
  data: () => ({ name: 'Negroni', available: true }),
};

const validData = { drinkId: 'drink-1', guestName: 'Alice', password: 'VELVET EAGLE' };

describe('normalizePassword', () => {
  it('ignores case, spacing, and punctuation', () => {
    expect(normalizePassword('velvet-eagle!')).toBe('VELVETEAGLE');
    expect(normalizePassword('  Velvet Eagle ')).toBe('VELVETEAGLE');
  });
});

describe('createOrderHandler', () => {
  beforeEach(() => {
    mockConfigGet.mockReset().mockResolvedValue(openBarConfig());
    mockPrivateGet.mockReset().mockResolvedValue({ data: () => ({ barPassword: 'VELVET EAGLE' }) });
    mockDrinkGet.mockReset().mockResolvedValue(availableDrink);
    mockOrderAdd.mockReset().mockResolvedValue({ id: 'order-123' });
    mockOrdersGet.mockReset().mockResolvedValue(ordersSnapshot([]));
    mockUserSet.mockReset().mockResolvedValue(undefined);
  });

  it('throws unauthenticated when request.auth is null', async () => {
    await expect(createOrderHandler(makeRequest(validData, null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('throws invalid-argument when guestName is missing or too long', async () => {
    await expect(createOrderHandler(makeRequest({ ...validData, guestName: '   ' }))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(
      createOrderHandler(makeRequest({ ...validData, guestName: 'x'.repeat(41) })),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws failed-precondition when the bar is closed', async () => {
    mockConfigGet.mockResolvedValue(openBarConfig({ barOpen: false }));
    await expect(createOrderHandler(makeRequest(validData))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('throws permission-denied for a wrong or missing password', async () => {
    await expect(
      createOrderHandler(makeRequest({ ...validData, password: 'SASSY WALRUS' })),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      createOrderHandler(makeRequest({ drinkId: 'drink-1', guestName: 'Alice' })),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts the password loosely formatted', async () => {
    await expect(
      createOrderHandler(makeRequest({ ...validData, password: ' velvet-eagle ' })),
    ).resolves.toEqual({ orderId: 'order-123' });
  });

  it('skips the password check when no password is configured', async () => {
    mockPrivateGet.mockResolvedValue({ data: () => ({ barPassword: null }) });
    await expect(
      createOrderHandler(makeRequest({ drinkId: 'drink-1', guestName: 'Alice' })),
    ).resolves.toEqual({ orderId: 'order-123' });
  });

  it('throttles guests with too many active orders', async () => {
    mockOrdersGet.mockResolvedValue(
      ordersSnapshot([
        { status: 'received', ageMs: 60_000 },
        { status: 'making', ageMs: 120_000 },
        { status: 'ready', ageMs: 180_000 },
      ]),
    );
    await expect(createOrderHandler(makeRequest(validData))).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('throttles guests ordering too fast, even when delivered', async () => {
    mockOrdersGet.mockResolvedValue(
      ordersSnapshot(Array.from({ length: 6 }, (_, i) => ({ status: 'delivered', ageMs: i * 30_000 }))),
    );
    await expect(createOrderHandler(makeRequest(validData))).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('does not count old delivered orders against the throttle', async () => {
    mockOrdersGet.mockResolvedValue(
      ordersSnapshot(Array.from({ length: 6 }, () => ({ status: 'delivered', ageMs: 60 * 60_000 }))),
    );
    await expect(createOrderHandler(makeRequest(validData))).resolves.toEqual({ orderId: 'order-123' });
  });

  it('throws not-found for a missing or unavailable drink', async () => {
    mockDrinkGet.mockResolvedValue({ exists: true, data: () => ({ name: 'Secret', available: false }) });
    await expect(createOrderHandler(makeRequest(validData))).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('writes the order with the expected shape and returns its id', async () => {
    mockConfigGet.mockResolvedValue(openBarConfig({ partyMode: true }));
    const result = await createOrderHandler(makeRequest(validData));

    expect(result).toEqual({ orderId: 'order-123' });
    expect(mockOrderAdd).toHaveBeenCalledWith({
      drinkId: 'drink-1',
      drinkName: 'Negroni',
      guestUid: 'guest-uid',
      guestName: 'Alice',
      status: 'received',
      partyMode: true,
      createdAt: 'SERVER_TIMESTAMP',
    });
  });

  it('persists a trimmed special-request note when provided', async () => {
    await createOrderHandler(makeRequest({ ...validData, note: '  no egg white  ' }));
    expect(mockOrderAdd).toHaveBeenCalledWith(expect.objectContaining({ note: 'no egg white' }));
  });

  it('omits the note field entirely when the note is empty', async () => {
    await createOrderHandler(makeRequest({ ...validData, note: '   ' }));
    const written = mockOrderAdd.mock.calls[0][0] as Record<string, unknown>;
    expect('note' in written).toBe(false);
  });

  it('rejects notes over 120 characters and non-string notes', async () => {
    await expect(
      createOrderHandler(makeRequest({ ...validData, note: 'x'.repeat(121) })),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      createOrderHandler(makeRequest({ ...validData, note: 42 } as unknown as OrderData)),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('persists the guest name to their user profile', async () => {
    await createOrderHandler(makeRequest({ ...validData, guestName: '  Alice  ' }));
    expect(mockUserSet).toHaveBeenCalledWith(
      { displayName: 'Alice', lastOrderAt: 'SERVER_TIMESTAMP' },
      { merge: true },
    );
  });
});
