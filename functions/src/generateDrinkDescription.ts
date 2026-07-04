import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertStaff } from './lib/adminGuard';
import { getAnthropicClient, HAIKU } from './lib/anthropic';

if (!admin.apps.length) admin.initializeApp();

interface GenDescRequest {
  name: string;
  ingredients: string[];
  category?: string;
}

interface GenDescResponse {
  description: string;
}

export const generateDrinkDescription = onCall<GenDescRequest, Promise<GenDescResponse>>(
  { secrets: ['ANTHROPIC_API_KEY'] },
  async (request) => {
    await assertStaff(request);

    const { name, ingredients, category = 'Cocktail' } = request.data;
    if (!name || ingredients.length === 0) {
      throw new HttpsError('invalid-argument', 'Name and ingredients required.');
    }

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: HAIKU,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Write a single evocative sentence (max 30 words) describing this ${category} for an upscale home bar menu. Make it sound luxurious and enticing but not overwrought.

Drink: ${name}
Ingredients: ${ingredients.join(', ')}

Respond with only the description sentence, no quotes or extra text.`,
        },
      ],
    });

    const description = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    return { description };
  },
);
