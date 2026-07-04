import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';

if (!admin.apps.length) admin.initializeApp();

// Anti-prank throttle: generous for a thirsty guest, hostile to queue-flooding
const MAX_ACTIVE_ORDERS = 3;
const MAX_RECENT_ORDERS = 6;
const RECENT_WINDOW_MS = 10 * 60 * 1000;

const ACTIVE_STATUSES = new Set(['received', 'viewed', 'making', 'ready']);

// "Velvet Eagle" and "velvet-eagle!" should both open the door
export function normalizePassword(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

interface CreateOrderRequest {
  drinkId: string;
  guestName: string;
  password?: string;
  note?: string;
}

interface CreateOrderResponse {
  orderId: string;
}

export async function createOrderHandler(
  request: CallableRequest<CreateOrderRequest>,
): Promise<CreateOrderResponse> {
  // Anonymous users are allowed — they are the primary guests.
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const uid = request.auth.uid;

  const { drinkId, guestName, password, note } = request.data ?? {};

  const name = typeof guestName === 'string' ? guestName.trim() : '';
  if (!name || name.length > 40) {
    throw new HttpsError('invalid-argument', 'A name (up to 40 characters) is required.');
  }
  if (!drinkId || typeof drinkId !== 'string') {
    throw new HttpsError('invalid-argument', 'drinkId is required.');
  }
  if (note !== undefined && typeof note !== 'string') {
    throw new HttpsError('invalid-argument', 'note must be a string.');
  }
  const trimmedNote = (note ?? '').trim();
  if (trimmedNote.length > 120) {
    throw new HttpsError('invalid-argument', 'Special requests are limited to 120 characters.');
  }
  if (password !== undefined && typeof password !== 'string') {
    throw new HttpsError('invalid-argument', 'password must be a string.');
  }

  const db = admin.firestore();

  const configSnap = await db.doc('config/app').get();
  const config = configSnap.data() ?? {};
  if (config.barOpen !== true) {
    throw new HttpsError('failed-precondition', 'The bar is closed right now.');
  }

  // The door password: set when the bar opens, shown at the party. Lives in
  // config/private (staff-only read) so guests can't just look it up.
  const privateSnap = await db.doc('config/private').get();
  const barPassword =
    typeof privateSnap.data()?.barPassword === 'string' ? (privateSnap.data()!.barPassword as string) : '';
  if (barPassword && normalizePassword(password ?? '') !== normalizePassword(barPassword)) {
    throw new HttpsError('permission-denied', "What's the password?");
  }

  // Throttle pranksters who do know the password
  const recentSnap = await db
    .collection('orders')
    .where('guestUid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(Math.max(MAX_RECENT_ORDERS, 10))
    .get();
  const now = Date.now();
  const recent = recentSnap.docs.map((d) => d.data());
  const activeCount = recent.filter((o) => ACTIVE_STATUSES.has(o.status as string)).length;
  const recentCount = recent.filter((o) => {
    const created = (o.createdAt as { toMillis(): number } | undefined)?.toMillis?.();
    return created !== undefined && now - created < RECENT_WINDOW_MS;
  }).length;
  if (activeCount >= MAX_ACTIVE_ORDERS) {
    throw new HttpsError('resource-exhausted', 'You already have drinks in the queue — let the bartender catch up.');
  }
  if (recentCount >= MAX_RECENT_ORDERS) {
    throw new HttpsError('resource-exhausted', 'Easy there — give it a few minutes before ordering again.');
  }

  const drinkSnap = await db.doc(`drinks/${drinkId}`).get();
  const drink = drinkSnap.data();
  if (!drinkSnap.exists || !drink || drink.available !== true) {
    throw new HttpsError('not-found', 'That drink is not available.');
  }

  const orderRef = await db.collection('orders').add({
    drinkId,
    drinkName: drink.name as string,
    guestUid: uid,
    guestName: name,
    status: 'received',
    partyMode: config.partyMode === true,
    ...(trimmedNote ? { note: trimmedNote } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });

  // Persist the name so returning guests don't retype it.
  await db.doc(`users/${uid}`).set(
    {
      displayName: name,
      lastOrderAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { orderId: orderRef.id };
}

export const createOrder = onCall<CreateOrderRequest, Promise<CreateOrderResponse>>(
  createOrderHandler,
);
