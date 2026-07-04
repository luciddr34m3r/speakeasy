import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendPushToStaff } = vi.hoisted(() => ({
  mockSendPushToStaff: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: { apps: ['app'], initializeApp: vi.fn() },
  apps: ['app'],
  initializeApp: vi.fn(),
}));

vi.mock('../lib/fcm', () => ({ sendPushToStaff: mockSendPushToStaff }));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn((_, handler) => handler),
}));

import { handleOrderCreate } from '../onOrderCreate';

describe('handleOrderCreate', () => {
  beforeEach(() => {
    mockSendPushToStaff.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing when order data is undefined', async () => {
    await handleOrderCreate('order-1', undefined);
    expect(mockSendPushToStaff).not.toHaveBeenCalled();
  });

  it('pushes the new order to all staff', async () => {
    await handleOrderCreate('order-abc', { guestName: 'Alice', drinkName: 'Negroni' });

    expect(mockSendPushToStaff).toHaveBeenCalledWith(
      '🍸 New order!',
      'Alice wants a Negroni',
      { orderId: 'order-abc', type: 'new_order' },
    );
  });
});
