import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { assertStaff } from './lib/adminGuard';

if (!admin.apps.length) admin.initializeApp();

interface GenImageRequest {
  name: string;
  ingredients: string[];
  prompt?: string;
}

interface GenImageResponse {
  imageBase64: string; // PNG
}

// House style — same as scripts/generate-drink-images.mjs so photos match the
// menu's look. Staff can override the entire prompt per generation.
export const DEFAULT_IMAGE_STYLE =
  'Moody upscale bar setting, dark background, dramatic side lighting, ' +
  'shallow depth of field, shot on a black marble surface. ' +
  'Photorealistic, editorial style, no text, no labels, no people.';

export function buildDefaultPrompt(name: string, ingredients: string[]): string {
  return `Professional cocktail photography of a ${name}. ` +
    `Ingredients: ${ingredients.slice(0, 3).join(', ')}. ` +
    `${DEFAULT_IMAGE_STYLE}`;
}

export async function generateDrinkImageHandler(
  request: CallableRequest<GenImageRequest>,
): Promise<GenImageResponse> {
  await assertStaff(request);

  const { name, ingredients, prompt } = request.data ?? {};
  if (!name || typeof name !== 'string' || !Array.isArray(ingredients) || ingredients.length === 0) {
    throw new HttpsError('invalid-argument', 'A drink name and ingredients are required.');
  }
  if (prompt !== undefined && typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'prompt must be a string.');
  }
  const finalPrompt =
    (prompt ?? '').trim().slice(0, 1500) || buildDefaultPrompt(name, ingredients.map(String));

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    // gpt-image-1 (DALL-E 3's successor) returns base64 by default; the old
    // response_format param is rejected by the current API.
    body: JSON.stringify({
      model: 'gpt-image-1',
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      prompt: finalPrompt,
    }),
  });

  if (!res.ok) {
    console.error('DALL-E request failed:', res.status, await res.text().catch(() => ''));
    throw new HttpsError('internal', `Image generation failed (${res.status}).`);
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const imageBase64 = json.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new HttpsError('internal', 'No image returned.');
  }

  return { imageBase64 };
}

export const generateDrinkImage = onCall<GenImageRequest, Promise<GenImageResponse>>(
  { secrets: ['OPENAI_API_KEY'], timeoutSeconds: 120 },
  generateDrinkImageHandler,
);
