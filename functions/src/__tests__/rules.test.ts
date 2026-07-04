import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv: RulesTestEnvironment;

const ADMIN_UID = 'admin-uid-123';
const GUEST_UID = 'guest-uid-456';
const OTHER_UID = 'other-uid-789';
const BARTENDER_UID = 'bartender-uid-321';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-speakeasy',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8'),
    },
  });

  // Seed config/app with adminUid
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('config/app').set({ adminUid: ADMIN_UID, partyMode: false, adminFcmTokens: [], bartenderUids: [BARTENDER_UID], bartenderNames: {} });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Re-seed config/app after each clear
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('config/app').set({ adminUid: ADMIN_UID, partyMode: false, adminFcmTokens: [], bartenderUids: [BARTENDER_UID], bartenderNames: {} });
  });
});

// ─── Helper contexts ──────────────────────────────────────────────────────────

function anonContext() {
  return testEnv.unauthenticatedContext();
}

function guestContext() {
  return testEnv.authenticatedContext(GUEST_UID);
}

function adminContext() {
  return testEnv.authenticatedContext(ADMIN_UID);
}

function otherContext() {
  return testEnv.authenticatedContext(OTHER_UID);
}

function bartenderContext() {
  return testEnv.authenticatedContext(BARTENDER_UID);
}

// ─── Drinks ───────────────────────────────────────────────────────────────────

describe('drinks collection', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('drinks/available-drink').set({ name: 'Negroni', available: true, category: 'Cocktails', ingredients: [] });
      await db.doc('drinks/unavailable-drink').set({ name: 'Secret', available: false, category: 'Hidden', ingredients: [] });
    });
  });

  it('allows anon user to read an available drink', async () => {
    const db = anonContext().firestore();
    await assertSucceeds(db.doc('drinks/available-drink').get());
  });

  it('denies anon user from reading an unavailable drink', async () => {
    const db = anonContext().firestore();
    await assertFails(db.doc('drinks/unavailable-drink').get());
  });

  it('allows authenticated guest to read an available drink', async () => {
    const db = guestContext().firestore();
    await assertSucceeds(db.doc('drinks/available-drink').get());
  });

  it('denies authenticated guest from reading an unavailable drink', async () => {
    const db = guestContext().firestore();
    await assertFails(db.doc('drinks/unavailable-drink').get());
  });

  it('allows admin to read all drinks including unavailable', async () => {
    const db = adminContext().firestore();
    await assertSucceeds(db.doc('drinks/unavailable-drink').get());
  });

  it('denies non-admin from writing to drinks', async () => {
    const db = guestContext().firestore();
    await assertFails(db.doc('drinks/new-drink').set({ name: 'Hack', available: true }));
  });

  it('allows admin to write to drinks', async () => {
    const db = adminContext().firestore();
    await assertSucceeds(db.doc('drinks/new-drink').set({ name: 'New Drink', available: true, category: 'Cocktails', ingredients: [] }));
  });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

describe('orders collection', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('orders/guest-order').set({
        drinkId: 'drink-1',
        drinkName: 'Negroni',
        guestUid: GUEST_UID,
        guestName: 'Alice',
        status: 'received',
        partyMode: false,
      });
    });
  });

  it('denies authenticated user from creating an order client-side (createOrder callable only)', async () => {
    const db = guestContext().firestore();
    await assertFails(
      db.doc('orders/new-order').set({
        drinkId: 'drink-1',
        drinkName: 'Negroni',
        guestUid: GUEST_UID,
        guestName: 'Alice',
        status: 'received',
        partyMode: false,
      }),
    );
  });

  it('denies unauthenticated user from creating an order', async () => {
    const db = anonContext().firestore();
    await assertFails(
      db.doc('orders/anon-order').set({
        drinkId: 'drink-1',
        drinkName: 'Negroni',
        guestUid: 'nobody',
        guestName: 'Ghost',
        status: 'received',
        partyMode: false,
      }),
    );
  });

  it('allows order owner to read their own order', async () => {
    const db = guestContext().firestore();
    await assertSucceeds(db.doc('orders/guest-order').get());
  });

  it('denies other user from reading someone else\'s order', async () => {
    const db = otherContext().firestore();
    await assertFails(db.doc('orders/guest-order').get());
  });

  it('allows admin to read any order', async () => {
    const db = adminContext().firestore();
    await assertSucceeds(db.doc('orders/guest-order').get());
  });

  it('denies non-admin from updating order status', async () => {
    const db = guestContext().firestore();
    await assertFails(db.doc('orders/guest-order').update({ status: 'delivered' }));
  });

  it('allows admin to update order status', async () => {
    const db = adminContext().firestore();
    await assertSucceeds(db.doc('orders/guest-order').update({ status: 'viewed' }));
  });

  it('allows owner to cancel their own received order', async () => {
    const db = guestContext().firestore();
    await assertSucceeds(
      db.doc('orders/guest-order').update({ status: 'cancelled', cancelledAt: new Date() }),
    );
  });

  it('denies owner from cancelling once the order has been viewed', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('orders/guest-order').update({ status: 'viewed' });
    });
    const db = guestContext().firestore();
    await assertFails(
      db.doc('orders/guest-order').update({ status: 'cancelled', cancelledAt: new Date() }),
    );
  });

  it('denies owner from moving status to anything other than cancelled', async () => {
    const db = guestContext().firestore();
    await assertFails(
      db.doc('orders/guest-order').update({ status: 'delivered', cancelledAt: new Date() }),
    );
  });

  it('denies owner cancel that also mutates other fields', async () => {
    const db = guestContext().firestore();
    await assertFails(
      db.doc('orders/guest-order').update({
        status: 'cancelled',
        cancelledAt: new Date(),
        drinkName: 'Something Else',
      }),
    );
  });

  it('denies non-owner from cancelling someone else\'s order', async () => {
    const db = otherContext().firestore();
    await assertFails(
      db.doc('orders/guest-order').update({ status: 'cancelled', cancelledAt: new Date() }),
    );
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

describe('users collection', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`users/${GUEST_UID}`).set({ displayName: 'Alice', isGoogleLinked: true, ratings: {} });
    });
  });

  it('allows user to read their own profile', async () => {
    const db = guestContext().firestore();
    await assertSucceeds(db.doc(`users/${GUEST_UID}`).get());
  });

  it('denies user from reading another user\'s profile', async () => {
    const db = otherContext().firestore();
    await assertFails(db.doc(`users/${GUEST_UID}`).get());
  });

  it('allows user to write their own profile', async () => {
    const db = guestContext().firestore();
    await assertSucceeds(db.doc(`users/${GUEST_UID}`).update({ displayName: 'Alicia' }));
  });

  it('denies user from writing another user\'s profile', async () => {
    const db = otherContext().firestore();
    await assertFails(db.doc(`users/${GUEST_UID}`).update({ displayName: 'Hacked' }));
  });
});

// ─── Config ───────────────────────────────────────────────────────────────────

describe('config/app document', () => {
  it('allows authenticated user to read config/app', async () => {
    const db = guestContext().firestore();
    await assertSucceeds(db.doc('config/app').get());
  });

  it('allows unauthenticated reads of config/app (theme must render pre-auth)', async () => {
    const db = anonContext().firestore();
    await assertSucceeds(db.doc('config/app').get());
  });

  it('keeps config/private staff-only', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('config/private').set({ barPassword: 'VELVET EAGLE' });
    });
    await assertFails(guestContext().firestore().doc('config/private').get());
    await assertFails(anonContext().firestore().doc('config/private').get());
    await assertSucceeds(bartenderContext().firestore().doc('config/private').get());
    await assertSucceeds(adminContext().firestore().doc('config/private').get());
    await assertSucceeds(bartenderContext().firestore().doc('config/private').set({ barPassword: 'NEW ONE' }));
  });

  it('denies non-admin from writing config/app', async () => {
    const db = guestContext().firestore();
    await assertFails(db.doc('config/app').update({ partyMode: true }));
  });

  it('allows admin to write config/app', async () => {
    const db = adminContext().firestore();
    await assertSucceeds(db.doc('config/app').update({ partyMode: true }));
  });
});

// ─── Guest bartenders (staff) ────────────────────────────────────────────────

describe('guest bartender permissions', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('orders/guest-order').set({
        drinkId: 'drink-1',
        drinkName: 'Negroni',
        guestUid: GUEST_UID,
        guestName: 'Alice',
        status: 'received',
        partyMode: false,
      });
      await db.doc('drinks/available-drink').set({ name: 'Negroni', available: true, category: 'Cocktails', ingredients: [] });
    });
  });

  it('allows a bartender to advance order status', async () => {
    const db = bartenderContext().firestore();
    await assertSucceeds(db.doc('orders/guest-order').update({ status: 'viewed' }));
  });

  it('allows a bartender to read any order', async () => {
    const db = bartenderContext().firestore();
    await assertSucceeds(db.doc('orders/guest-order').get());
  });

  it('allows a bartender to write drinks', async () => {
    const db = bartenderContext().firestore();
    await assertSucceeds(db.doc('drinks/available-drink').update({ available: false }));
  });

  it('allows a bartender to update bar-operations config fields', async () => {
    const db = bartenderContext().firestore();
    await assertSucceeds(db.doc('config/app').update({ partyMode: true, barOpen: true }));
  });

  it('denies a bartender from touching the staff or token lists', async () => {
    const db = bartenderContext().firestore();
    await assertFails(db.doc('config/app').update({ bartenderUids: [] }));
    await assertFails(db.doc('config/app').update({ adminUid: BARTENDER_UID }));
    await assertFails(db.doc('config/app').update({ adminFcmTokens: ['stolen'] }));
  });

  it('still denies a random signed-in user from staff actions', async () => {
    const db = otherContext().firestore();
    await assertFails(db.doc('orders/guest-order').update({ status: 'viewed' }));
    await assertFails(db.doc('config/app').update({ barOpen: true }));
  });
});
