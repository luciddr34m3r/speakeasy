import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRateLimit, mockCreate, mockGet } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockCreate: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: {
    apps: ['app'],
    firestore: () => ({ collection: () => ({ where: () => ({ get: mockGet }) }) }),
    initializeApp: vi.fn(),
  },
  apps: ['app'],
  firestore: () => ({ collection: () => ({ where: () => ({ get: mockGet }) }) }),
  initializeApp: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_, handler) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

vi.mock('../lib/anthropic', () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  SONNET: 'claude-sonnet-test',
}));

vi.mock('../lib/rateLimiter', () => ({ assertRateLimit: mockRateLimit, assertGlobalDailyBudget: vi.fn().mockResolvedValue(undefined) }));

import { recommendDrinkHandler } from '../recommendDrink';
import type { CallableRequest } from 'firebase-functions/v2/https';

type PartialRequest = {
  auth?: { uid: string; token: { firebase: { sign_in_provider: string } } } | undefined;
  data: { transcript?: string; ratings?: Record<string, number> };
};

function makeRequest(overrides: Partial<PartialRequest> = {}): CallableRequest<{ transcript: string; ratings?: Record<string, number> }> {
  return {
    auth: {
      uid: 'google-uid',
      token: { firebase: { sign_in_provider: 'google.com' } },
    },
    data: { transcript: 'something smoky', ratings: {} },
    rawRequest: {} as CallableRequest['rawRequest'],
    acceptsStreaming: false,
    ...overrides,
  } as unknown as CallableRequest<{ transcript: string; ratings?: Record<string, number> }>;
}

const sampleDrinks = [
  { id: 'drink-1', data: () => ({ name: 'Negroni', description: 'Bitter.', ingredients: ['gin', 'campari'], category: 'Cocktails', available: true }) },
  { id: 'drink-2', data: () => ({ name: 'Spritz', description: 'Bubbly.', ingredients: ['prosecco'], category: 'Bubbles', available: true }) },
];

describe('recommendDrinkHandler', () => {
  beforeEach(() => {
    mockRateLimit.mockReset().mockResolvedValue(undefined);
    mockCreate.mockReset();
    mockGet.mockReset();
  });

  it('throws unauthenticated when request.auth is null', async () => {
    await expect(recommendDrinkHandler(makeRequest({ auth: undefined }))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('throws unauthenticated for anonymous users', async () => {
    const req = makeRequest({
      auth: { uid: 'anon-uid', token: { firebase: { sign_in_provider: 'anonymous' } } },
    });
    await expect(recommendDrinkHandler(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mockRateLimit).not.toHaveBeenCalled();
  });

  it('throws invalid-argument when transcript is empty', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: sampleDrinks });
    await expect(recommendDrinkHandler(makeRequest({ data: { transcript: '   ' } }))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws not-found when no drinks are available', async () => {
    mockGet.mockResolvedValue({ empty: true, docs: [] });
    await expect(recommendDrinkHandler(makeRequest())).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('returns a recommendation when AI returns valid JSON', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: sampleDrinks });
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"drinkId":"drink-1","drinkName":"Negroni","reason":"Bold and bitter."}' }],
    });

    const result = await recommendDrinkHandler(makeRequest());
    expect(result.drinkId).toBe('drink-1');
    expect(result.drinkName).toBe('Negroni');
    expect(result.reason).toBe('Bold and bitter.');
  });

  it('strips markdown fences before parsing (Sonnet loves fences)', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: sampleDrinks });
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"drinkId":"drink-1","drinkName":"Negroni","reason":"Bold."}\n```' }],
    });
    const result = await recommendDrinkHandler(makeRequest());
    expect(result.drinkId).toBe('drink-1');
  });

  it('rejects transcripts over 300 characters', async () => {
    await expect(
      recommendDrinkHandler(makeRequest({ data: { transcript: 'x'.repeat(301), ratings: {} } })),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('caps the returned reason length', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: sampleDrinks });
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drinkId: 'drink-1', drinkName: 'Negroni', reason: 'y'.repeat(1000) }) }],
    });
    const result = await recommendDrinkHandler(makeRequest());
    expect(result.reason.length).toBeLessThanOrEqual(240);
  });

  it('throws internal when AI returns malformed JSON', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: sampleDrinks });
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });

    await expect(recommendDrinkHandler(makeRequest())).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('throws internal when AI returns drinkId not in menu', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: sampleDrinks });
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"drinkId":"unknown-id","drinkName":"Ghost","reason":"Haunting."}' }],
    });

    await expect(recommendDrinkHandler(makeRequest())).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('calls assertRateLimit with the user uid', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: sampleDrinks });
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"drinkId":"drink-1","drinkName":"Negroni","reason":"Classic."}' }],
    });

    await recommendDrinkHandler(makeRequest());
    expect(mockRateLimit).toHaveBeenCalledWith('google-uid');
  });

  it('propagates resource-exhausted from rate limiter', async () => {
    const { HttpsError } = await import('firebase-functions/v2/https');
    mockRateLimit.mockRejectedValue(new HttpsError('resource-exhausted', 'Rate limit exceeded.'));

    await expect(recommendDrinkHandler(makeRequest())).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });
});
