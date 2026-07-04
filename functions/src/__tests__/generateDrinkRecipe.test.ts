import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAssertAdmin, mockCreate, mockDrinksGet } = vi.hoisted(() => ({
  mockAssertAdmin: vi.fn(),
  mockCreate: vi.fn(),
  mockDrinksGet: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = () => ({ collection: () => ({ get: mockDrinksGet }) });
  return {
    default: { apps: ['app'], firestore, initializeApp: vi.fn() },
    apps: ['app'],
    firestore,
    initializeApp: vi.fn(),
  };
});

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
  SONNET: 'claude-sonnet-test',
}));

import { generateDrinkRecipeHandler } from '../generateDrinkRecipe';
import type { CallableRequest } from 'firebase-functions/v2/https';

function makeRequest(prompt: unknown) {
  return { auth: { uid: 'admin' }, data: { prompt } } as unknown as CallableRequest<{ prompt: string }>;
}

const validRecipe = {
  name: 'Smoke Signal',
  description: 'Mezcal and grapefruit in a haze of campfire romance.',
  ingredients: ['2 oz mezcal', '1 oz grapefruit juice', '½ oz agave nectar'],
  category: 'Modern Classics',
};

describe('generateDrinkRecipeHandler', () => {
  beforeEach(() => {
    mockAssertAdmin.mockReset().mockResolvedValue(undefined);
    mockCreate.mockReset().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validRecipe) }],
    });
    mockDrinksGet.mockReset().mockResolvedValue({
      docs: [
        { data: () => ({ category: 'Sours' }) },
        { data: () => ({ category: 'Classics' }) },
        { data: () => ({ category: 'Sours' }) },
      ],
    });
  });

  it('calls assertAdmin before doing anything', async () => {
    await generateDrinkRecipeHandler(makeRequest('something smoky'));
    expect(mockAssertAdmin).toHaveBeenCalledOnce();
  });

  it('throws invalid-argument for a missing or empty prompt', async () => {
    await expect(generateDrinkRecipeHandler(makeRequest('  '))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(generateDrinkRecipeHandler(makeRequest(undefined))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument for prompts over 500 characters', async () => {
    await expect(generateDrinkRecipeHandler(makeRequest('x'.repeat(501)))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('feeds the deduplicated existing categories into the prompt', async () => {
    await generateDrinkRecipeHandler(makeRequest('something smoky'));
    const content = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain('Sours, Classics');
    expect(content).toContain('something smoky');
  });

  it('parses a clean JSON response', async () => {
    const result = await generateDrinkRecipeHandler(makeRequest('something smoky'));
    expect(result).toEqual(validRecipe);
  });

  it('strips markdown fences before parsing', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(validRecipe) + '\n```' }],
    });
    const result = await generateDrinkRecipeHandler(makeRequest('something smoky'));
    expect(result.name).toBe('Smoke Signal');
  });

  it('throws internal on unparseable output', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'here is your drink!' }] });
    await expect(generateDrinkRecipeHandler(makeRequest('something smoky'))).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('throws internal when the recipe is missing name or ingredients', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ description: 'nice', ingredients: [] }) }],
    });
    await expect(generateDrinkRecipeHandler(makeRequest('something smoky'))).rejects.toMatchObject({
      code: 'internal',
    });
  });
});
