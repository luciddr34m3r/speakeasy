import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendEachForMulticast = vi.fn();

vi.mock('firebase-admin', () => ({
  default: {
    apps: ['app'],
    messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
    initializeApp: vi.fn(),
  },
  apps: ['app'],
  messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
  initializeApp: vi.fn(),
}));

import { sendPush } from '../lib/fcm';

describe('sendPush', () => {
  beforeEach(() => {
    mockSendEachForMulticast.mockReset();
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

  it('calls sendEachForMulticast with valid tokens', async () => {
    await sendPush(['token-1', 'token-2'], 'Hello', 'World');
    expect(mockSendEachForMulticast).toHaveBeenCalledOnce();
    const call = mockSendEachForMulticast.mock.calls[0][0];
    expect(call.tokens).toEqual(['token-1', 'token-2']);
    expect(call.notification.title).toBe('Hello');
    expect(call.notification.body).toBe('World');
  });

  it('filters out falsy tokens before sending', async () => {
    await sendPush(['token-1', '', 'token-2'], 'Title', 'Body');
    const call = mockSendEachForMulticast.mock.calls[0][0];
    expect(call.tokens).toEqual(['token-1', 'token-2']);
  });

  it('includes optional data payload', async () => {
    await sendPush(['token-1'], 'Title', 'Body', { orderId: 'abc' });
    const call = mockSendEachForMulticast.mock.calls[0][0];
    expect(call.data).toEqual({ orderId: 'abc' });
  });
});
