import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendEachForMulticast, mockUpdate } = vi.hoisted(() => ({
  mockSendEachForMulticast: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = () => ({ doc: () => ({ update: mockUpdate, get: vi.fn().mockResolvedValue({ data: () => ({}) }) }) });
  return {
    default: {
      apps: ['app'],
      messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
      firestore,
      initializeApp: vi.fn(),
    },
    apps: ['app'],
    messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
    firestore,
    initializeApp: vi.fn(),
  };
});

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayRemove: (...tokens: string[]) => ({ ARRAY_REMOVE: tokens }),
  },
}));

import { sendPush } from '../lib/fcm';

describe('sendPush', () => {
  beforeEach(() => {
    mockSendEachForMulticast.mockReset();
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
  });

  it('does nothing when tokens array is empty', async () => {
    await sendPush([], 'Title', 'Body');
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('does nothing when all tokens are falsy', async () => {
    await sendPush(['', ''], 'Title', 'Body');
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends a data-only payload (SW is the single display path)', async () => {
    await sendPush(['token-1', 'token-2'], 'Hello', 'World');
    expect(mockSendEachForMulticast).toHaveBeenCalledOnce();
    const call = mockSendEachForMulticast.mock.calls[0][0];
    expect(call.tokens).toEqual(['token-1', 'token-2']);
    expect(call.notification).toBeUndefined();
    expect(call.data).toEqual({ title: 'Hello', body: 'World' });
    expect(call.webpush).toEqual({ headers: { Urgency: 'high' } });
  });

  it('filters out falsy tokens before sending', async () => {
    await sendPush(['token-1', '', 'token-2'], 'Title', 'Body');
    const call = mockSendEachForMulticast.mock.calls[0][0];
    expect(call.tokens).toEqual(['token-1', 'token-2']);
  });

  it('merges optional data into the payload alongside title/body', async () => {
    await sendPush(['token-1'], 'Title', 'Body', { orderId: 'abc' });
    const call = mockSendEachForMulticast.mock.calls[0][0];
    expect(call.data).toEqual({ title: 'Title', body: 'Body', orderId: 'abc' });
  });

  it('removes stale tokens from the cleanup target', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'gone' } },
        { success: false, error: { code: 'messaging/invalid-registration-token', message: 'bad' } },
      ],
    });

    await sendPush(['ok-token', 'stale-token', 'bad-token'], 'Title', 'Body', undefined, {
      docPath: 'users/guest-uid',
      field: 'fcmTokens',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      fcmTokens: { ARRAY_REMOVE: ['stale-token', 'bad-token'] },
    });
  });

  it('does not clean up on transient failures', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [{ success: false, error: { code: 'messaging/internal-error', message: 'flaky' } }],
    });

    await sendPush(['token-1'], 'Title', 'Body', undefined, {
      docPath: 'config/app',
      field: 'adminFcmTokens',
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not clean up when no cleanup target is given', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'gone' } },
      ],
    });

    await sendPush(['stale-token'], 'Title', 'Body');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
