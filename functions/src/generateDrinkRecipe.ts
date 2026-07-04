import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getAnthropicClient, SONNET } from './lib/anthropic';
import { assertStaff } from './lib/adminGuard';

if (!admin.apps.length) admin.initializeApp();

interface GenRecipeRequest {
  prompt: string;
}

interface GenRecipeResponse {
  name: string;
  description: string;
  ingredients: string[];
  category: string;
}

export async function generateDrinkRecipeHandler(
  request: CallableRequest<GenRecipeRequest>,
): Promise<GenRecipeResponse> {
  await assertStaff(request);

  const prompt = typeof request.data?.prompt === 'string' ? request.data.prompt.trim() : '';
  if (!prompt || prompt.length > 500) {
    throw new HttpsError('invalid-argument', 'Describe the drink in up to 500 characters.');
  }

  // Existing categories keep AI-created drinks grouped with the rest of the menu
  const drinksSnap = await admin.firestore().collection('drinks').get();
  const categories = [...new Set(drinksSnap.docs.map((d) => d.data().category as string).filter(Boolean))];

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content:
          `You are the head bartender at an upscale home speakeasy. Create one cocktail recipe from this request:\n\n` +
          `"${prompt}"\n\n` +
          `Existing menu categories: ${categories.join(', ') || 'Cocktails'}. Use one of these if it fits, otherwise propose a new one.\n\n` +
          `Respond with a JSON object only, no extra text:\n` +
          `{\n` +
          `  "name": "Drink Name",\n` +
          `  "description": "one evocative sentence, max 25 words",\n` +
          `  "ingredients": ["2 oz ingredient with quantity", "..."],\n` +
          `  "category": "Category"\n` +
          `}`,
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  let recipe: GenRecipeResponse;
  try {
    recipe = JSON.parse(cleaned) as GenRecipeResponse;
  } catch {
    throw new HttpsError('internal', 'Could not parse the recipe response.');
  }

  if (!recipe.name || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new HttpsError('internal', 'The recipe response was incomplete.');
  }

  return {
    name: String(recipe.name),
    description: String(recipe.description ?? ''),
    ingredients: recipe.ingredients.map(String),
    category: String(recipe.category ?? 'Cocktails'),
  };
}

export const generateDrinkRecipe = onCall<GenRecipeRequest, Promise<GenRecipeResponse>>(
  { secrets: ['ANTHROPIC_API_KEY'] },
  generateDrinkRecipeHandler,
);
