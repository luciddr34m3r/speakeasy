/**
 * Inject Firebase config values into the service worker before deploying.
 * Run after `npm run build --prefix web` and before `firebase deploy`.
 *
 * Usage: node scripts/inject-sw-config.mjs
 *
 * Requires a .env.production file (copy from web/.env.production.template).
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Read env
const envPath = resolve(root, 'web/.env.production');
const envRaw = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('=').map((s) => s.trim())),
);

const swPath = resolve(root, 'web/dist/firebase-messaging-sw.js');
let sw = readFileSync(swPath, 'utf8');

// Replace __FIREBASE_*__ placeholders with actual values
const replacements = {
  __FIREBASE_API_KEY__: env.VITE_FIREBASE_API_KEY,
  __FIREBASE_AUTH_DOMAIN__: env.VITE_FIREBASE_AUTH_DOMAIN,
  __FIREBASE_PROJECT_ID__: env.VITE_FIREBASE_PROJECT_ID,
  __FIREBASE_STORAGE_BUCKET__: env.VITE_FIREBASE_STORAGE_BUCKET,
  __FIREBASE_MESSAGING_SENDER_ID__: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  __FIREBASE_APP_ID__: env.VITE_FIREBASE_APP_ID,
};

for (const [placeholder, value] of Object.entries(replacements)) {
  if (!value) { console.warn(`⚠  Missing value for ${placeholder}`); continue; }
  sw = sw.replaceAll(`${placeholder}`, `'${value}'`);
}

writeFileSync(swPath, sw);
console.log('✓ Service worker config injected');
