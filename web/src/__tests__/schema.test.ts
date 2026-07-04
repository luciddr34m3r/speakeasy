import { describe, it, expect } from 'vitest';
import { DrinkSchema, OrderSchema, UserProfileSchema, AppConfigSchema, OrderStatusValues } from '../lib/schema';

describe('DrinkSchema', () => {
  it('parses a valid drink', () => {
    const result = DrinkSchema.parse({ name: 'Negroni' });
    expect(result.name).toBe('Negroni');
    expect(result.available).toBe(true);
    expect(result.category).toBe('Cocktails');
    expect(result.ingredients).toEqual([]);
    expect(result.description).toBe('');
  });

  it('throws on missing name', () => {
    expect(() => DrinkSchema.parse({})).toThrow();
  });

  it('throws on empty name', () => {
    expect(() => DrinkSchema.parse({ name: '' })).toThrow();
  });

  it('preserves supplied values', () => {
    const result = DrinkSchema.parse({
      name: 'Old Fashioned',
      description: 'Classic.',
      ingredients: ['bourbon', 'bitters'],
      category: 'Whiskey',
      available: false,
    });
    expect(result.description).toBe('Classic.');
    expect(result.ingredients).toEqual(['bourbon', 'bitters']);
    expect(result.category).toBe('Whiskey');
    expect(result.available).toBe(false);
  });
});

describe('OrderSchema', () => {
  const base = {
    drinkId: 'abc',
    drinkName: 'Margarita',
    guestUid: 'uid-1',
    guestName: 'Alice',
  };

  it('parses a valid order with defaults', () => {
    const result = OrderSchema.parse(base);
    expect(result.status).toBe('received');
    expect(result.partyMode).toBe(false);
  });

  it('accepts all valid statuses', () => {
    for (const status of OrderStatusValues) {
      expect(() => OrderSchema.parse({ ...base, status })).not.toThrow();
    }
  });

  it('throws on invalid status', () => {
    expect(() => OrderSchema.parse({ ...base, status: 'exploded' })).toThrow();
  });

  it('accepts optional distanceM', () => {
    const result = OrderSchema.parse({ ...base, distanceM: 42 });
    expect(result.distanceM).toBe(42);
  });
});

describe('UserProfileSchema', () => {
  it('accepts valid ratings of 1 and -1', () => {
    const result = UserProfileSchema.parse({
      displayName: 'Bob',
      ratings: { drinkA: 1, drinkB: -1 },
    });
    expect(result.ratings.drinkA).toBe(1);
    expect(result.ratings.drinkB).toBe(-1);
  });

  it('rejects ratings other than 1 and -1', () => {
    expect(() =>
      UserProfileSchema.parse({ displayName: 'Bob', ratings: { drinkA: 0 } }),
    ).toThrow();
    expect(() =>
      UserProfileSchema.parse({ displayName: 'Bob', ratings: { drinkA: 2 } }),
    ).toThrow();
  });

  it('defaults empty ratings and fcmTokens', () => {
    const result = UserProfileSchema.parse({ displayName: 'Bob' });
    expect(result.ratings).toEqual({});
    expect(result.fcmTokens).toEqual([]);
    expect(result.isGoogleLinked).toBe(false);
  });
});

describe('AppConfigSchema', () => {
  it('requires adminUid', () => {
    expect(() => AppConfigSchema.parse({ partyMode: false })).toThrow();
  });

  it('parses with defaults', () => {
    const result = AppConfigSchema.parse({ adminUid: 'uid-admin' });
    expect(result.partyMode).toBe(false);
    expect(result.adminFcmTokens).toEqual([]);
    expect(result.barOpen).toBe(false);
    expect(result.theme).toBe('speakeasy');
  });

  it('accepts known themes and rejects unknown ones', () => {
    expect(AppConfigSchema.parse({ adminUid: 'x', theme: 'july4' }).theme).toBe('july4');
    expect(() => AppConfigSchema.parse({ adminUid: 'x', theme: 'xmas' })).toThrow();
  });

});

describe('OrderStatusValues', () => {
  it('contains exactly the expected statuses in order', () => {
    expect(OrderStatusValues).toEqual(['received', 'viewed', 'making', 'ready', 'delivered', 'cancelled']);
  });
});
