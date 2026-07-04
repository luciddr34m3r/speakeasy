import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { sendPushToStaff } from './lib/fcm';

if (!admin.apps.length) admin.initializeApp();

export async function handleOrderCreate(
  orderId: string,
  order: { guestName: string; drinkName: string } | undefined,
): Promise<void> {
  if (!order) return;

  await sendPushToStaff(
    '🍸 New order!',
    `${order.guestName} wants a ${order.drinkName}`,
    { orderId, type: 'new_order' },
  );
}

export const onOrderCreate = onDocumentCreated('orders/{orderId}', (event) =>
  handleOrderCreate(event.params.orderId, event.data?.data() as { guestName: string; drinkName: string } | undefined),
);
