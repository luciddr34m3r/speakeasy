import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockAssertAdmin, mockFetch } = vi.hoisted(() => ({
  mockAssertAdmin: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: { apps: ['app'], initializeApp: vi.fn() },
  apps: ['app'],
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

vi.mock('../lib/adminGuard', () => ({ assertAdmin: mockAssertAdmin, assertStaff: mockAssertAdmin }));

import { generateDrinkImageHandler } from '../generateDrinkImage';
import type { CallableRequest } from 'firebase-functions/v2/https';

function makeRequest(data: { name?: unknown; ingredients?: unknown }) {
  return { auth: { uid: 'admin' }, data } as unknown as CallableRequest<{ name: string; ingredients: string[] }>;
}

const validData = { name: 'Negroni', ingredients: ['1 oz gin', '1 oz Campari', '1 oz sweet vermouth', 'orange peel'] };

describe('generateDrinkImageHandler', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockAssertAdmin.mockReset().mockResolvedValue(undefined);
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'base64-image-data' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls assertAdmin before generating', async () => {
    await generateDrinkImageHandler(makeRequest(validData));
    expect(mockAssertAdmin).toHaveBeenCalledOnce();
  });

  it('throws invalid-argument when name or ingredients are missing', async () => {
    await expect(generateDrinkImageHandler(makeRequest({ ingredients: ['gin'] }))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(generateDrinkImageHandler(makeRequest({ name: 'Negroni', ingredients: [] }))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends a gpt-image-1 request with the house prompt style and first 3 ingredients', async () => {
    await generateDrinkImageHandler(makeRequest(validData));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-image-1');
    expect(body.response_format).toBeUndefined();
    expect(body.prompt).toContain('Professional cocktail photography of a Negroni');
    expect(body.prompt).toContain('1 oz gin, 1 oz Campari, 1 oz sweet vermouth');
    expect(body.prompt).not.toContain('orange peel');
  });

  it('uses a full custom prompt verbatim when provided and rejects non-string prompts', async () => {
    await generateDrinkImageHandler(
      makeRequest({ ...validData, prompt: 'A tiki mug on a sunny beach, ultra colorful' } as typeof validData & { prompt: string }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.prompt).toBe('A tiki mug on a sunny beach, ultra colorful');

    await expect(
      generateDrinkImageHandler(makeRequest({ ...validData, prompt: 42 } as unknown as typeof validData)),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('returns the base64 image', async () => {
    await expect(generateDrinkImageHandler(makeRequest(validData))).resolves.toEqual({
      imageBase64: 'base64-image-data',
    });
  });

  it('throws internal when the API responds non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });
    await expect(generateDrinkImageHandler(makeRequest(validData))).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('throws internal when no image comes back', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    await expect(generateDrinkImageHandler(makeRequest(validData))).rejects.toMatchObject({
      code: 'internal',
    });
  });
});
