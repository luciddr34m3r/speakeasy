import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { assertAdmin } from './lib/adminGuard';

if (!admin.apps.length) admin.initializeApp();

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
// No lookalike characters (0/O, 1/I) — codes get read aloud across a bar
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(length = 6): string {
  const bytes = randomBytes(length);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

interface CreateInviteResponse {
  code: string;
  expiresAt: number; // epoch ms
}

export async function createBartenderInviteHandler(
  request: CallableRequest,
): Promise<CreateInviteResponse> {
  await assertAdmin(request);

  const code = generateCode();
  const expiresAt = Date.now() + INVITE_TTL_MS;
  await admin.firestore().doc('config/bartenderInvite').set({
    code,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAt),
  });

  return { code, expiresAt };
}

export const createBartenderInvite = onCall(createBartenderInviteHandler);

interface ClaimInviteRequest {
  code: string;
  name?: string;
}

interface ClaimInviteResponse {
  ok: true;
}

export async function claimBartenderInviteHandler(
  request: CallableRequest<ClaimInviteRequest>,
): Promise<ClaimInviteResponse> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
  // Anonymous uids are device-bound and get abandoned — a bartender needs a
  // stable identity so the admin can recognize and revoke them.
  if (request.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new HttpsError('failed-precondition', 'Sign in with Google first.');
  }

  const code = typeof request.data?.code === 'string' ? request.data.code.trim().toUpperCase() : '';
  if (!code) throw new HttpsError('invalid-argument', 'An invite code is required.');

  const db = admin.firestore();
  const inviteSnap = await db.doc('config/bartenderInvite').get();
  const invite = inviteSnap.data();
  if (!inviteSnap.exists || !invite || invite.code !== code) {
    throw new HttpsError('not-found', 'That invite code is not valid.');
  }
  if ((invite.expiresAt as Timestamp).toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'That invite has expired — ask for a new one.');
  }

  const uid = request.auth.uid;
  if (request.data?.name !== undefined && typeof request.data.name !== 'string') {
    throw new HttpsError('invalid-argument', 'name must be a string.');
  }
  const providedName = (request.data?.name ?? '').trim();
  if (providedName.length > 40) {
    throw new HttpsError('invalid-argument', 'Names are limited to 40 characters.');
  }
  const name =
    providedName ||
    (request.auth.token.name as string | undefined) ||
    (request.auth.token.email as string | undefined) ||
    'Guest bartender';

  await db.doc('config/app').update({
    bartenderUids: FieldValue.arrayUnion(uid),
    [`bartenderNames.${uid}`]: name,
  });
  // One identity everywhere — the queue, their orders, and their profile
  await db.doc(`users/${uid}`).set({ displayName: name }, { merge: true });
  // Single use
  await db.doc('config/bartenderInvite').delete();

  return { ok: true };
}

export const claimBartenderInvite = onCall<ClaimInviteRequest, Promise<ClaimInviteResponse>>(
  claimBartenderInviteHandler,
);
