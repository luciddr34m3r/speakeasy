/**
 * Seed Firestore with sample drinks and app config.
 * Uses the Admin SDK so it bypasses Firestore security rules entirely.
 *
 * Local emulator (default):
 *   node scripts/seed-emulator.mjs
 *   Requires: npm run emulate
 *
 * Production:
 *   node scripts/seed-emulator.mjs --prod
 *   Requires: gcloud auth application-default login
 *   WARNING: writes directly to the live database.
 */
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.argv.includes('--prod');

// Emulator seeds get local photos from web/public/drink-images (committed to the
// repo); prod photos live in Firebase Storage via generate-drink-images.mjs.
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
function localPhotoPath(name) {
  if (isProd) return null;
  const slug = slugify(name);
  const file = resolve(__dirname, '../web/public/drink-images', `${slug}.jpg`);
  return existsSync(file) ? `/drink-images/${slug}.jpg` : null;
}

if (isProd) {
  console.log('🚀 Targeting PRODUCTION (the-speakeasy-e3533)\n');
  admin.initializeApp({
    projectId: 'the-speakeasy-e3533',
    credential: admin.credential.applicationDefault(),
  });
} else {
  console.log('🧪 Targeting LOCAL EMULATOR\n');
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  admin.initializeApp({ projectId: 'demo-speakeasy' });
}

const db = admin.firestore();

// ─── App config ─────────────────────────────────────────────────────────────
// Replace 'YOUR_ADMIN_UID' with your actual Firebase Auth UID.
// Find it in the Firebase console (Authentication tab) after signing in with Google.
await db.doc('config/app').set({
  partyMode: false,
  adminUid: 'YOUR_ADMIN_UID',
  adminFcmTokens: [],
  barOpen: false,
  geofenceRadiusM: 150,
});
console.log('✓ config/app set');

// ─── Sample drinks ───────────────────────────────────────────────────────────
const drinks = [
  {
    name: 'Old Fashioned',
    description: 'A timeless union of whiskey, bitters, and a single orange peel — the gold standard of cocktails.',
    ingredients: ['2 oz bourbon or rye whiskey', '1 sugar cube', '2 dashes Angostura bitters', 'Orange peel, for garnish', 'Ice'],
    category: 'Classics',
    available: true,
    photoPath: null,
  },
  {
    name: 'Negroni',
    description: 'Equal parts gin, Campari, and sweet vermouth produce a boldly bitter aperitivo of uncommon elegance.',
    ingredients: ['1 oz gin', '1 oz Campari', '1 oz sweet vermouth', 'Orange peel, for garnish', 'Ice'],
    category: 'Classics',
    available: true,
    photoPath: null,
  },
  {
    name: 'Whiskey Sour',
    description: 'Tart lemon and silky bourbon shake into a perfectly balanced sour with a pillowy foam crown.',
    ingredients: ['2 oz bourbon', '¾ oz fresh lemon juice', '½ oz simple syrup', '1 egg white (optional)', 'Lemon wheel & cherry, for garnish'],
    category: 'Sours',
    available: true,
    photoPath: null,
  },
  {
    name: 'Espresso Martini',
    description: 'Cold-brew espresso shaken with vodka and Kahlúa into a velvety, caffeine-laced nightcap.',
    ingredients: ['1½ oz vodka', '1 oz Kahlúa', '1 oz fresh espresso (chilled)', '¼ oz simple syrup', 'Coffee beans, for garnish'],
    category: 'After Dinner',
    available: true,
    photoPath: null,
  },
  {
    name: 'French 75',
    description: 'Gin, lemon, and sugar lifted skyward with Champagne — effervescent, bright, impossibly refreshing.',
    ingredients: ['1 oz gin', '½ oz fresh lemon juice', '½ oz simple syrup', '2 oz Champagne or sparkling wine', 'Lemon twist, for garnish'],
    category: 'Fizzes',
    available: true,
    photoPath: null,
  },
  {
    name: 'Dark & Stormy',
    description: 'Goslings Black Seal rum and fiery ginger beer collide in a drink as dramatic as its name.',
    ingredients: ['2 oz dark rum', '4 oz ginger beer', '½ oz fresh lime juice', 'Lime wedge, for garnish', 'Ice'],
    category: 'Highballs',
    available: true,
    photoPath: null,
  },
  {
    name: 'Last Word',
    description: 'A Prohibition-era equal-parts gem — herbal, tart, and hauntingly balanced in every sip.',
    ingredients: ['¾ oz gin', '¾ oz green Chartreuse', '¾ oz maraschino liqueur', '¾ oz fresh lime juice'],
    category: 'Classics',
    available: true,
    photoPath: null,
  },
  {
    name: 'Naked and Famous',
    description: 'Smoky mezcal and bitter Aperol meet herbal Chartreuse in a perfectly symmetrical modern classic.',
    ingredients: ['¾ oz mezcal', '¾ oz Aperol', '¾ oz yellow Chartreuse', '¾ oz fresh lime juice'],
    category: 'Modern Classics',
    available: true,
    photoPath: null,
  },
  {
    name: 'Paper Plane',
    description: 'Four equal parts fold into something greater than their sum — bitter, bright, and endlessly sippable.',
    ingredients: ['¾ oz bourbon', '¾ oz Aperol', '¾ oz Amaro Nonino', '¾ oz fresh lemon juice'],
    category: 'Modern Classics',
    available: true,
    photoPath: null,
  },
  {
    name: 'Tom Collins',
    description: 'A long, leisurely gin drink built for warm evenings — crisp lemon and lazy bubbles in a tall glass.',
    ingredients: ['2 oz gin', '1 oz fresh lemon juice', '½ oz simple syrup', '3 oz club soda', 'Lemon wheel & cherry, for garnish', 'Ice'],
    category: 'Fizzes',
    available: true,
    photoPath: null,
  },
  {
    name: 'Margarita',
    description: 'The definitive tequila cocktail — blazing lime and orange liqueur balanced on a salted rim.',
    ingredients: ['2 oz tequila blanco', '¾ oz fresh lime juice', '½ oz Cointreau', 'Kosher salt, for rim', 'Lime wheel, for garnish', 'Ice'],
    category: 'Classics',
    available: true,
    photoPath: null,
  },
  {
    name: 'Moscow Mule',
    description: 'Crisp vodka and ferociously spiced ginger beer over ice — best served ice-cold in a copper mug.',
    ingredients: ['2 oz vodka', '½ oz fresh lime juice', '4 oz ginger beer', 'Lime wedge, for garnish', 'Ice'],
    category: 'Highballs',
    available: true,
    photoPath: null,
  },
  {
    name: 'Aviation',
    description: 'A violet-hued relic of the golden age of cocktails — floral, perfumed, and unexpectedly delicate.',
    ingredients: ['2 oz gin', '¾ oz fresh lemon juice', '½ oz maraschino liqueur', '¼ oz crème de violette', 'Brandied cherry, for garnish'],
    category: 'Classics',
    available: true,
    photoPath: null,
  },
  {
    name: 'Gin and Tonic',
    description: 'A study in elegant simplicity — the botanicals of fine gin allowed to breathe through cold tonic.',
    ingredients: ['2 oz gin', '4 oz tonic water', 'Lime wedge', 'Ice'],
    category: 'Highballs',
    available: true,
    photoPath: null,
  },
  {
    name: "Tommy's Margarita",
    description: "Julio Bermejo's agave-forward reinvention strips the Margarita to its pure, essential three-ingredient form.",
    ingredients: ['2 oz tequila blanco (100% agave)', '1 oz fresh lime juice', '½ oz agave nectar', 'Lime wheel, for garnish', 'Ice'],
    category: 'Classics',
    available: true,
    photoPath: null,
  },
];

for (const drink of drinks) {
  const ref = db.collection('drinks').doc();
  await ref.set({
    ...drink,
    photoPath: drink.photoPath ?? localPhotoPath(drink.name),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✓ ${drink.name} (${ref.id})`);
}

const target = isProd ? 'https://the-speakeasy-e3533.web.app' : 'http://localhost:4000';
console.log(`\nDone! ${isProd ? 'Check the Firebase console.' : `Visit ${target} to see the emulator UI.`}`);
process.exit(0);
