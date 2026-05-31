import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { sendPush } from './lib/fcm';

if (!admin.apps.length) admin.initializeApp();

interface OrderData {
  status: string;
  partyMode: boolean;
  guestUid: string;
  drinkName: string;
}

export async function handleOrderStatusChange(
  orderId: string,
  before: OrderData | undefined,
  after: OrderData | undefined,
): Promise<void> {
  if (!before || !after) return;
  if (before.status === after.status) return;

  // Only notify guest when ready, and only when partyMode was on for this order
  if (after.status === 'ready' && after.partyMode === true) {
    const userSnap = await admin.firestore().doc(`users/${after.guestUid}`).get();
    const guestTokens: string[] = userSnap.data()?.fcmTokens ?? [];

    await sendPush(
      guestTokens,
      '🍹 Your drink is ready!',
      `Come grab your ${after.drinkName}`,
      { orderId, type: 'order_ready' },
    );
  }
}

export const onOrderStatusChange = onDocumentUpdated('orders/{orderId}', (event) =>
  handleOrderStatusChange(
    event.params.orderId,
    event.data?.before.data() as OrderData | undefined,
    event.data?.after.data() as OrderData | undefined,
  ),
);
