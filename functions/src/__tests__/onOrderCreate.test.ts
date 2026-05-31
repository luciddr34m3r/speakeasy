import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendPush, mockGet } = vi.hoisted(() => ({
  mockSendPush: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: {
    apps: ['app'],
    firestore: () => ({ doc: () => ({ get: mockGet }) }),
    initializeApp: vi.fn(),
  },
  apps: ['app'],
  firestore: () => ({ doc: () => ({ get: mockGet }) }),
  initializeApp: vi.fn(),
}));

vi.mock('../lib/fcm', () => ({ sendPush: mockSendPush }));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn((_, handler) => handler),
}));

import { handleOrderCreate } from '../onOrderCreate';

describe('handleOrderCreate', () => {
  beforeEach(() => {
    mockSendPush.mockReset();
    mockGet.mockReset();
  });

  it('does nothing when order data is undefined', async () => {
    await handleOrderCreate('order-1', undefined);
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('sends push to admin tokens with order details', async () => {
    mockGet.mockResolvedValue({
      data: () => ({ adminFcmTokens: ['admin-token-1', 'admin-token-2'] }),
    });
    mockSendPush.mockResolvedValue(undefined);

    await handleOrderCreate('order-abc', { guestName: 'Alice', drinkName: 'Negroni' });

    expect(mockSendPush).toHaveBeenCalledWith(
      ['admin-token-1', 'admin-token-2'],
      '🍸 New order!',
      'Alice wants a Negroni',
      { orderId: 'order-abc', type: 'new_order' },
    );
  });

  it('sends push to empty array when config has no admin tokens', async () => {
    mockGet.mockResolvedValue({ data: () => ({}) });
    mockSendPush.mockResolvedValue(undefined);

    await handleOrderCreate('order-1', { guestName: 'Bob', drinkName: 'Spritz' });

    expect(mockSendPush).toHaveBeenCalledWith(
      [],
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });
});
