import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendPush, mockSendPushToStaff, mockGet } = vi.hoisted(() => ({
  mockSendPush: vi.fn(),
  mockSendPushToStaff: vi.fn(),
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

vi.mock('../lib/fcm', () => ({
  sendPush: mockSendPush,
  sendPushToStaff: mockSendPushToStaff,
  tokensFromUserData: (data: Record<string, unknown> | undefined) => [
    ...(((data?.fcmTokens as string[]) ?? [])),
    ...((((data?.fcmDevices as Array<{ token: string }>) ?? [])).map((d) => d.token)),
  ],
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentUpdated: vi.fn((_, handler) => handler),
}));

import { handleOrderStatusChange } from '../onOrderStatusChange';

interface OrderData {
  status: string;
  partyMode: boolean;
  guestUid: string;
  guestName: string;
  drinkName: string;
}

const baseOrder: OrderData = {
  status: 'received',
  partyMode: false,
  guestUid: 'guest-uid',
  guestName: 'Alice',
  drinkName: 'Negroni',
};

describe('handleOrderStatusChange', () => {
  beforeEach(() => {
    mockSendPush.mockReset();
    mockSendPushToStaff.mockReset().mockResolvedValue(undefined);
    mockGet.mockReset();
  });

  it('does nothing when before data is undefined', async () => {
    await handleOrderStatusChange('o1', undefined, { ...baseOrder, status: 'viewed' });
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('does nothing when after data is undefined', async () => {
    await handleOrderStatusChange('o1', baseOrder, undefined);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('does nothing when status has not changed', async () => {
    await handleOrderStatusChange('o1', baseOrder, { ...baseOrder });
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('does not notify when status becomes ready but partyMode is false', async () => {
    await handleOrderStatusChange(
      'o1',
      { ...baseOrder, status: 'making' },
      { ...baseOrder, status: 'ready', partyMode: false },
    );
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('notifies guest when status becomes ready and partyMode is true', async () => {
    mockGet.mockResolvedValue({ data: () => ({ fcmTokens: ['guest-token'] }) });
    mockSendPush.mockResolvedValue(undefined);

    await handleOrderStatusChange(
      'order-1',
      { ...baseOrder, status: 'making', partyMode: true },
      { ...baseOrder, status: 'ready', partyMode: true },
    );

    expect(mockSendPush).toHaveBeenCalledWith(
      ['guest-token'],
      '🍹 Your drink is ready!',
      'Come grab your Negroni',
      { orderId: 'order-1', type: 'order_ready' },
      { docPath: 'users/guest-uid', field: 'fcmTokens' },
    );
  });

  it('does not notify for other status transitions even in partyMode', async () => {
    await handleOrderStatusChange(
      'o1',
      { ...baseOrder, status: 'received', partyMode: true },
      { ...baseOrder, status: 'making', partyMode: true },
    );
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('notifies all staff when a guest cancels', async () => {
    await handleOrderStatusChange(
      'order-2',
      { ...baseOrder, status: 'received' },
      { ...baseOrder, status: 'cancelled' },
    );

    expect(mockSendPushToStaff).toHaveBeenCalledWith(
      'Order cancelled',
      'Alice cancelled their Negroni',
      { orderId: 'order-2', type: 'order_cancelled' },
    );
  });
});
