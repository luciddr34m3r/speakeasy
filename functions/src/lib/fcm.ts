import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  cleanup?: { docPath: string; field: string },
): Promise<void> {
  if (tokens.length === 0) return;
  const validTokens = tokens.filter(Boolean);
  if (validTokens.length === 0) return;

  // Data-only payload: the app's service worker is the single display path.
  // A `notification` block would ALSO be auto-shown by the Firebase SDK,
  // producing duplicate notifications.
  const response = await admin.messaging().sendEachForMulticast({
    tokens: validTokens,
    data: { title, body, ...data },
    webpush: {
      headers: { Urgency: 'high' },
    },
  });

  console.log(`FCM: ${response.successCount}/${validTokens.length} delivered`);
  const staleTokens: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success) {
      console.error(`FCM token[${i}] failed:`, r.error?.code, r.error?.message);
      if (r.error?.code && STALE_TOKEN_CODES.has(r.error.code)) {
        staleTokens.push(validTokens[i]);
      }
    }
  });

  if (cleanup && staleTokens.length > 0) {
    const docRef = admin.firestore().doc(cleanup.docPath);
    await docRef.update({
      [cleanup.field]: FieldValue.arrayRemove(...staleTokens),
    });
    // Also prune the device list, which stores { token, label, addedAt } objects
    const snap = await docRef.get();
    const devices = snap.data()?.fcmDevices as Array<{ token: string }> | undefined;
    if (devices?.some((d) => staleTokens.includes(d.token))) {
      await docRef.update({ fcmDevices: devices.filter((d) => !staleTokens.includes(d.token)) });
    }
    console.log(`FCM: removed ${staleTokens.length} stale token(s) from ${cleanup.docPath}`);
  }
}

/** All of a user's tokens: labeled devices plus any legacy bare tokens. */
export function tokensFromUserData(data: FirebaseFirestore.DocumentData | undefined): string[] {
  const legacy = (data?.fcmTokens as string[] | undefined) ?? [];
  const devices = ((data?.fcmDevices as Array<{ token: string }> | undefined) ?? []).map((d) => d.token);
  return [...new Set([...legacy, ...devices])];
}

/**
 * Push to everyone behind the bar. All staff tokens (admin included) live on
 * their own users/{uid} docs; legacy config/app.adminFcmTokens is still
 * drained during the transition.
 */
export async function sendPushToStaff(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const db = admin.firestore();
  const configSnap = await db.doc('config/app').get();
  const config = configSnap.data() ?? {};

  const adminUid = config.adminUid as string | undefined;
  const bartenderUids: string[] = (config.bartenderUids as string[] | undefined) ?? [];
  const staffUids = [...new Set([adminUid, ...bartenderUids].filter(Boolean))] as string[];

  for (const uid of staffUids) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const tokens = tokensFromUserData(userSnap.data());
    await sendPush(tokens, title, body, data, { docPath: `users/${uid}`, field: 'fcmTokens' });
  }

  // Legacy admin tokens registered before device management existed
  const legacyAdminTokens: string[] = (config.adminFcmTokens as string[] | undefined) ?? [];
  if (legacyAdminTokens.length > 0) {
    await sendPush(legacyAdminTokens, title, body, data, { docPath: 'config/app', field: 'adminFcmTokens' });
  }
}
