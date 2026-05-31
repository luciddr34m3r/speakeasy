import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from './lib/adminGuard';
import { getAnthropicClient, HAIKU } from './lib/anthropic';
import { FieldValue } from 'firebase-admin/firestore';

if (!admin.apps.length) admin.initializeApp();

interface SeedMenuRequest {
  drinks: Array<{
    name: string;
    category?: string;
  }>;
}

interface SeedMenuResponse {
  created: number;
}

interface DrinkData {
  name: string;
  description: string;
  ingredients: string[];
  category: string;
}

export const seedMenu = onCall<SeedMenuRequest, Promise<SeedMenuResponse>>(
  { secrets: ['ANTHROPIC_API_KEY'] },
  async (request) => {
    await assertAdmin(request);

    const { drinks } = request.data;
    if (!drinks?.length) throw new HttpsError('invalid-argument', 'Drinks list required.');

    const client = getAnthropicClient();
    const prompt = `For each of the following cocktails, provide the classic recipe and an evocative one-sentence description (max 25 words) for an upscale bar menu.

Respond with a JSON array only, no extra text:
[
  {
    "name": "Drink Name",
    "description": "one sentence description",
    "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
    "category": "Cocktails | Sours | Fizzes | Classics | etc."
  }
]

Drinks to generate:
${drinks.map((d) => `- ${d.name}${d.category ? ` (${d.category})` : ''}`).join('\n')}`;

    const response = await client.messages.create({
      model: HAIKU,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    let generated: DrinkData[];
    try {
      generated = JSON.parse(raw) as DrinkData[];
    } catch {
      throw new HttpsError('internal', 'Could not parse Claude response.');
    }

    const batch = admin.firestore().batch();
    for (const drink of generated) {
      const ref = admin.firestore().collection('drinks').doc();
      batch.set(ref, {
        ...drink,
        available: true,
        photoPath: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return { created: generated.length };
  },
);
