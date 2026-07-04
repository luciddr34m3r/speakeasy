import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAssertAdmin, mockCreate } = vi.hoisted(() => ({
  mockAssertAdmin: vi.fn(),
  mockCreate: vi.fn(),
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

vi.mock('../lib/anthropic', () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  HAIKU: 'claude-haiku-test',
}));

import { generateDrinkDescription } from '../generateDrinkDescription';

type Handler = (request: { auth: unknown; data: { name?: string; ingredients?: string[]; category?: string } }) => Promise<{ description: string }>;
const handler = generateDrinkDescription as unknown as Handler;

describe('generateDrinkDescription', () => {
  beforeEach(() => {
    mockAssertAdmin.mockReset().mockResolvedValue(undefined);
    mockCreate.mockReset();
  });

  it('calls assertAdmin', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'A fine cocktail.' }] });
    await handler({ auth: {}, data: { name: 'Negroni', ingredients: ['gin'] } });
    expect(mockAssertAdmin).toHaveBeenCalledOnce();
  });

  it('throws invalid-argument when name is missing', async () => {
    await expect(
      handler({ auth: {}, data: { ingredients: ['gin'] } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when ingredients is empty', async () => {
    await expect(
      handler({ auth: {}, data: { name: 'Negroni', ingredients: [] } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('returns trimmed description from AI response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '  A bold, bitter classic.  ' }],
    });

    const result = await handler({ auth: {}, data: { name: 'Negroni', ingredients: ['gin', 'campari'] } });
    expect(result.description).toBe('A bold, bitter classic.');
  });

  it('returns empty string for non-text response', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'image' }] });

    const result = await handler({ auth: {}, data: { name: 'Negroni', ingredients: ['gin'] } });
    expect(result.description).toBe('');
  });
});
