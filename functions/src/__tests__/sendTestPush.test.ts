import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAssertStaff, mockSendPush, mockUserGet } = vi.hoisted(() => ({
  mockAssertStaff: vi.fn(),
  mockSendPush: vi.fn(),
  mockUserGet: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = () => ({
    doc: (path: string) => {
      if (path.startsWith('users/')) return { get: mockUserGet };
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

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((handler) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

vi.mock('../lib/adminGuard', () => ({ assertStaff: mockAssertStaff }));
vi.mock('../lib/fcm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/fcm')>();
  return { ...actual, sendPush: mockSendPush };
});

import { sendTestPushHandler } from '../sendTestPush';
import type { CallableRequest } from 'firebase-functions/v2/https';

function makeRequest(uid: string) {
  return { auth: { uid }, data: {} } as unknown as CallableRequest;
}

describe('sendTestPushHandler', () => {
  beforeEach(() => {
    mockAssertStaff.mockReset().mockResolvedValue(undefined);
    mockSendPush.mockReset().mockResolvedValue(undefined);
    mockUserGet.mockReset().mockResolvedValue({
      data: () => ({
        fcmTokens: ['legacy-token'],
        fcmDevices: [{ token: 'device-token', label: 'iPhone · Safari', addedAt: 1 }],
      }),
    });
  });

  it('requires staff', async () => {
    await sendTestPushHandler(makeRequest('admin-uid'));
    expect(mockAssertStaff).toHaveBeenCalledOnce();
  });

  it("pushes to all of the caller's device and legacy tokens with cleanup", async () => {
    const result = await sendTestPushHandler(makeRequest('staff-uid'));
    expect(result).toEqual({ sentTo: 2 });
    expect(mockSendPush).toHaveBeenCalledWith(
      ['legacy-token', 'device-token'],
      expect.stringContaining('Test'),
      expect.any(String),
      { type: 'test' },
      { docPath: 'users/staff-uid', field: 'fcmTokens' },
    );
  });

  it('fails clearly when no tokens are registered', async () => {
    mockUserGet.mockResolvedValue({ data: () => ({}) });
    await expect(sendTestPushHandler(makeRequest('staff-uid'))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    expect(mockSendPush).not.toHaveBeenCalled();
  });
});
