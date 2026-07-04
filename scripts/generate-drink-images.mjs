/**
 * Generate cocktail photos via gpt-image-1 and upload them to Firebase Storage.
 * Updates each drink's Firestore document with the resulting photo URL.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-drink-images.mjs
 *
 * Local mode — write downsized JPGs for the emulator seed instead of uploading:
 *   OPENAI_API_KEY=sk-... node scripts/generate-drink-images.mjs --local-out web/public/drink-images
 *   (no Storage upload, no Firestore update; seed-emulator.mjs picks the files
 *   up by slug and serves them from Vite's public/ directory)
 *
 * Targets the PRODUCTION Firebase project (the-speakeasy-e3533).
 * Run AFTER deploying so Firestore already has drink documents.
 *
 * Cost: ~$0.04 per image (gpt-image-1, medium, 1024x1024). 15 drinks ≈ $0.60.
 */

import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

const __dirname = dirname(fileURLToPath(import.meta.url));

const localOutFlag = process.argv.indexOf('--local-out');
const LOCAL_OUT = localOutFlag !== -1 ? resolve(__dirname, '..', process.argv[localOutFlag + 1]) : null;

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

  // gpt-image-1 (DALL-E 3's successor — the old response_format param is
  // rejected by the current API); returns base64 by default
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: buildPrompt(drink),
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    }),
  });
  if (!res.ok) throw new Error(`Image generation failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const response = await res.json();

  const b64 = response.data[0].b64_json;
  const buffer = Buffer.from(b64, 'base64');

  const slug = drink.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Local mode: write a downsized JPG for the emulator seed, skip upload
  if (LOCAL_OUT) {
    const sharp = require('../node_modules/sharp');
    const jpg = await sharp(buffer).resize(640, 640).jpeg({ quality: 70 }).toBuffer();
    mkdirSync(LOCAL_OUT, { recursive: true });
    const outFile = resolve(LOCAL_OUT, `${slug}.jpg`);
    writeFileSync(outFile, jpg);
    console.log(`  ✓ Wrote ${outFile} (${Math.round(jpg.length / 1024)} KB)`);
    return null;
  }

  // Upload to Firebase Storage
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

  // Skip if already has a photo (local mode regenerates regardless — the
  // output files are for the emulator seed, not this Firestore project)
  if (drink.photoPath && !LOCAL_OUT) {
    console.log(`⏭  ${drink.name} — already has a photo, skipping`);
    continue;
  }

  try {
    const photoPath = await generateAndUpload(drink);
    if (photoPath) {
      await docSnap.ref.update({
        photoPath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ Firestore updated`);
    }

    // Brief pause to stay well within rate limits
    await new Promise((r) => setTimeout(r, 1500));
  } catch (err) {
    console.error(`  ✗ Failed for ${drink.name}:`, err.message);
  }
}

console.log('\nDone!');
process.exit(0);
