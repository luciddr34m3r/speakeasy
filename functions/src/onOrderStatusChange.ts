import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { sendPush, sendPushToStaff, tokensFromUserData } from './lib/fcm';

if (!admin.apps.length) admin.initializeApp();

interface OrderData {
  status: string;
  partyMode: boolean;
  guestUid: string;
  guestName: string;
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
    const guestTokens = tokensFromUserData(userSnap.data());

    await sendPush(
      guestTokens,
      '🍹 Your drink is ready!',
      `Come grab your ${after.drinkName}`,
      { orderId, type: 'order_ready' },
      { docPath: `users/${after.guestUid}`, field: 'fcmTokens' },
    );
  }

  // Tell the bartenders when a guest cancels so nobody makes a ghost drink
  if (after.status === 'cancelled') {
    await sendPushToStaff(
      'Order cancelled',
      `${after.guestName} cancelled their ${after.drinkName}`,
      { orderId, type: 'order_cancelled' },
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
