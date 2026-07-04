import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { assertStaff } from './lib/adminGuard';
import { sendPush, tokensFromUserData } from './lib/fcm';

if (!admin.apps.length) admin.initializeApp();

interface TestPushResponse {
  sentTo: number;
}

/**
 * Fires a real FCM push at the caller's own registered tokens so staff can
 * verify the whole server → FCM → service worker → notification path.
 */
export async function sendTestPushHandler(
  request: CallableRequest,
): Promise<TestPushResponse> {
  await assertStaff(request);
  const uid = request.auth!.uid;

  const db = admin.firestore();
  const userSnap = await db.doc(`users/${uid}`).get();
  const tokens = tokensFromUserData(userSnap.data());
  const cleanup = { docPath: `users/${uid}`, field: 'fcmTokens' };

  if (tokens.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'No notification tokens registered for your account yet — tap Enable notifications first.',
    );
  }

  await sendPush(
    tokens,
    '🔔 Test notification',
    'If you can read this, order pings will reach you.',
    { type: 'test' },
    cleanup,
  );

  return { sentTo: tokens.length };
}

export const sendTestPush = onCall(sendTestPushHandler);
