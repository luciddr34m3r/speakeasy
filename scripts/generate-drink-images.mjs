/**
 * Generate cocktail photos via DALL-E 3 and upload them to Firebase Storage.
 * Updates each drink's Firestore document with the resulting photo URL.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-drink-images.mjs
 *
 * Targets the PRODUCTION Firebase project (the-speakeasy-e3533).
 * Run AFTER deploying so Firestore already has drink documents.
 *
 * Cost: ~$0.04 per image (DALL-E 3, 1024x1024). 15 drinks ≈ $0.60 total.
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const OpenAI = require('../node_modules/openai').default;

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ────────────────────────────────────────────────────────────────

const PROJECT_ID = 'the-speakeasy-e3533';
const STORAGE_BUCKET = `${PROJECT_ID}.firebasestorage.app`;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

// ─── Init ──────────────────────────────────────────────────────────────────

admin.initializeApp({
  projectId: PROJECT_ID,
  storageBucket: STORAGE_BUCKET,
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ─── Image generation ──────────────────────────────────────────────────────

function buildPrompt(drink) {
  return `Professional cocktail photography of a ${drink.name}. ` +
    `Ingredients: ${drink.ingredients.slice(0, 3).join(', ')}. ` +
    `Moody upscale bar setting, dark background, dramatic side lighting, ` +
    `shallow depth of field, shot on a black marble surface. ` +
    `Photorealistic, editorial style, no text, no labels, no people.`;
}

async function generateAndUpload(drink) {
  console.log(`\n🍸 Generating: ${drink.name}…`);

  // Generate with DALL-E 3
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: buildPrompt(drink),
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'b64_json',
  });

  const b64 = response.data[0].b64_json;
  const buffer = Buffer.from(b64, 'base64');

  // Upload to Firebase Storage
  const slug = drink.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const storagePath = `drinks/${slug}.png`;
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: { contentType: 'image/png' },
    public: true,
  });

  const publicUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/${storagePath}`;
  console.log(`  ✓ Uploaded → ${publicUrl}`);
  return publicUrl;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const drinksSnap = await db.collection('drinks').get();

if (drinksSnap.empty) {
  console.error('No drinks found in Firestore. Deploy and seed the menu first.');
  process.exit(1);
}

console.log(`Found ${drinksSnap.size} drinks. Generating images…`);
console.log(`Estimated cost: ~$${(drinksSnap.size * 0.04).toFixed(2)}\n`);

for (const docSnap of drinksSnap.docs) {
  const drink = { id: docSnap.id, ...docSnap.data() };

  // Skip if already has a photo
  if (drink.photoPath) {
    console.log(`⏭  ${drink.name} — already has a photo, skipping`);
    continue;
  }

  try {
    const photoPath = await generateAndUpload(drink);
    await docSnap.ref.update({
      photoPath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ Firestore updated`);

    // Brief pause to stay well within rate limits
    await new Promise((r) => setTimeout(r, 1500));
  } catch (err) {
    console.error(`  ✗ Failed for ${drink.name}:`, err.message);
  }
}

console.log('\nDone!');
process.exit(0);
