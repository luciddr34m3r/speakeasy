import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getAnthropicClient, SONNET } from './lib/anthropic';
import { assertRateLimit } from './lib/rateLimiter';

if (!admin.apps.length) admin.initializeApp();

interface RecommendRequest {
  transcript: string;
  ratings?: Record<string, number>;
}

interface RecommendResponse {
  drinkId: string;
  drinkName: string;
  reason: string;
}

export async function recommendDrinkHandler(
  request: CallableRequest<RecommendRequest>,
): Promise<RecommendResponse> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  // Block anonymous users — only Google-authenticated accounts may use AI recommendations
  if (request.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Sign in with Google to use recommendations.');
  }

  await assertRateLimit(request.auth.uid);

  const { transcript, ratings = {} } = request.data;
  if (!transcript?.trim()) throw new HttpsError('invalid-argument', 'Transcript required.');

  // Fetch available drinks
  const drinksSnap = await admin.firestore()
    .collection('drinks')
    .where('available', '==', true)
    .get();

  if (drinksSnap.empty) throw new HttpsError('not-found', 'No drinks available.');

  const drinks = drinksSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    description: d.data().description as string,
    ingredients: (d.data().ingredients as string[]).join(', '),
    category: d.data().category as string,
  }));

  const menuText = drinks
    .map((d) => `ID: ${d.id}\nName: ${d.name}\nCategory: ${d.category}\nIngredients: ${d.ingredients}\nDescription: ${d.description}`)
    .join('\n\n---\n\n');

  // Build ratings context
  const ratedDrinks = Object.entries(ratings)
    .map(([id, score]) => {
      const drink = drinks.find((d) => d.id === id);
      return drink ? `${drink.name}: ${score > 0 ? 'liked' : 'disliked'}` : null;
    })
    .filter(Boolean);

  const ratingsContext = ratedDrinks.length > 0
    ? `\n\nThe guest has rated drinks before:\n${ratedDrinks.join('\n')}`
    : '';

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 512,
    system: 'You are a world-class bartender with excellent taste. Recommend exactly one drink from the menu based on the guest\'s description. Respond with valid JSON only: {"drinkId": "...", "drinkName": "...", "reason": "..."}. The reason should be one evocative sentence that makes the drink sound irresistible.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Here is today's available menu:\n\n${menuText}`,
            // Cache the menu for repeated calls in the same session
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `The guest said: "${transcript}"${ratingsContext}\n\nRecommend exactly one drink from the menu above.`,
          },
        ],
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    const result = JSON.parse(raw) as RecommendResponse;
    if (!drinks.find((d) => d.id === result.drinkId)) {
      throw new Error('drinkId not in menu');
    }
    return result;
  } catch {
    throw new HttpsError('internal', 'Could not parse recommendation response.');
  }
}

export const recommendDrink = onCall<RecommendRequest, Promise<RecommendResponse>>(
  { secrets: ['ANTHROPIC_API_KEY'] },
  recommendDrinkHandler,
);
