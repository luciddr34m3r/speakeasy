import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';

const mockDoc = vi.hoisted(() => vi.fn());

vi.mock('firebase-admin', () => ({
  default: { apps: ['app'], firestore: () => ({ doc: mockDoc }), initializeApp: vi.fn() },
  apps: ['app'],
  firestore: () => ({ doc: mockDoc }),
  initializeApp: vi.fn(),
}));

import { assertAdmin } from '../lib/adminGuard';

function makeRequest(uid: string | null): CallableRequest {
  return {
    auth: uid ? ({ uid } as CallableRequest['auth']) : undefined,
    data: {},
    rawRequest: {} as CallableRequest['rawRequest'],
    acceptsStreaming: false,
  };
}

function mockAdminDoc(adminUid: string | undefined) {
  const docRef = {
    get: vi.fn().mockResolvedValue({
      data: () => (adminUid ? { adminUid } : undefined),
    }),
  };
  mockDoc.mockReturnValue(docRef);
  return docRef;
}

describe('assertAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReset();
  });

  it('throws unauthenticated when request.auth is null', async () => {
    const request = makeRequest(null);
    await expect(assertAdmin(request)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('throws permission-denied when uid does not match adminUid', async () => {
    mockAdminDoc('admin-uid');
    const request = makeRequest('other-uid');
    await expect(assertAdmin(request)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('throws permission-denied when config doc does not exist', async () => {
    mockAdminDoc(undefined);
    const request = makeRequest('some-uid');
    await expect(assertAdmin(request)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('resolves when uid matches adminUid', async () => {
    mockAdminDoc('admin-uid');
    const request = makeRequest('admin-uid');
    await expect(assertAdmin(request)).resolves.toBeUndefined();
  });

  it('throws HttpsError instances', async () => {
    const request = makeRequest(null);
    try {
      await assertAdmin(request);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
    }
  });
});
