import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

const MAX_REQUESTS = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Per-instance in-memory cache to avoid hitting Firestore on every call.
// Not shared across instances — acceptable for home-party scale.
const cache = new Map<string, { count: number; windowStart: number; cachedAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function assertRateLimit(uid: string): Promise<void> {
  const now = Date.now();

  // Serve from cache if fresh and under limit
  const cached = cache.get(uid);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    if (cached.count >= MAX_REQUESTS && now - cached.windowStart < WINDOW_MS) {
      throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again in an hour.');
    }
  }

  const db = admin.firestore();
  const ref = db.doc(`rateLimits/${uid}`);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    const data = snap.data() as { count: number; windowStart: number } | undefined;

    if (!data || now - data.windowStart > WINDOW_MS) {
      txn.set(ref, { count: 1, windowStart: now });
      cache.set(uid, { count: 1, windowStart: now, cachedAt: now });
      return;
    }

    if (data.count >= MAX_REQUESTS) {
      throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again in an hour.');
    }

    txn.update(ref, { count: data.count + 1 });
    cache.set(uid, { count: data.count + 1, windowStart: data.windowStart, cachedAt: now });
  });
}

const GLOBAL_DAILY_MAX = 300;

/**
 * A hard daily ceiling across ALL users — the backstop that keeps a botnet
 * of Google accounts from draining the API key overnight.
 */
export async function assertGlobalDailyBudget(): Promise<void> {
  const db = admin.firestore();
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc('rateLimits/_global');

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    const data = snap.data() as { day: string; count: number } | undefined;

    if (!data || data.day !== day) {
      txn.set(ref, { day, count: 1 });
      return;
    }
    if (data.count >= GLOBAL_DAILY_MAX) {
      throw new HttpsError('resource-exhausted', "The bartender's AI is off duty for today.");
    }
    txn.update(ref, { count: data.count + 1 });
  });
}
