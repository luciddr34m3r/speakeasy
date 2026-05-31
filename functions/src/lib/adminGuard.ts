import * as admin from 'firebase-admin';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';

export async function assertAdmin(request: CallableRequest): Promise<void> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  const configSnap = await admin.firestore().doc('config/app').get();
  const adminUid = configSnap.data()?.adminUid as string | undefined;
  if (!adminUid || request.auth.uid !== adminUid) {
    throw new HttpsError('permission-denied', 'Must be the bar admin.');
  }
}
