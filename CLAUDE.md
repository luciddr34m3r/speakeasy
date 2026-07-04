# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow

Never commit directly to `master`. For every change: branch from up-to-date `master` → commit → push → open a PR (`gh pr create`) → wait for ALL CI checks to pass → merge. Merging to `master` triggers `deploy.yml`, which builds with production secrets and deploys hosting + functions + rules automatically — no manual `npm run deploy` needed for merged work (keep it for emergency hotfixes only). PR pushes get a Firebase preview channel deploy with a URL comment. Never commit build/test artifacts (`web/coverage`, `web/playwright-report`, `web/test-results` are gitignored).

## Commands

All commands are run from the repo root unless noted.

**Development**
```bash
npm run emulate              # Start all Firebase emulators (auth:9099, firestore:8080, functions:5001, storage:9199, hosting:5050, UI:4000)
npm run emulate:import       # Start emulators with persisted data
npm run dev                  # Start Vite dev server (web only, connects to emulators in DEV mode)
node scripts/seed-emulator.mjs  # Seed emulator with sample drinks + app config (emulators must be running)
```

**Build**
```bash
npm run build                # Build web (tsc + vite)
npm run build:functions      # Build functions (tsc → lib/)
npm run deploy               # Full deploy: build web + build functions + firebase deploy
```

**Tests**
```bash
# Web
npm run test --prefix web            # Unit tests (vitest, jsdom)
npm run test:watch --prefix web      # Watch mode
npm run test:coverage --prefix web   # With coverage (thresholds: 60% across all metrics)
npm run test:e2e --prefix web        # Playwright e2e

# Functions
npm run test --prefix functions               # Unit tests (vitest, node)
npm run test:rules --prefix functions         # Firestore security rules tests — requires emulator running on :8080

# Single test file
npx vitest run src/__tests__/recommendDrink.test.ts --prefix functions
```

**Lint & typecheck**
```bash
npm run lint --prefix web            # ESLint
npx tsc -b --prefix web             # Typecheck web
npx tsc --noEmit --prefix functions # Typecheck functions
```

## Architecture

This is a home-bar ordering app with a monorepo layout:
- `web/` — React 19 + Vite SPA (TypeScript, MUI v9, react-router-dom v7)
- `functions/` — Firebase Cloud Functions v2 (Node 22, TypeScript, compiled to `lib/`)
- `scripts/` — Node ESM utility scripts (seeding, image generation, SW config injection)
- `firestore.rules` / `storage.rules` — security rules at repo root

### Firebase services
- **Auth**: every visitor is signed in anonymously on load (`web/src/lib/firebase.ts`). Google sign-in is used only to elevate to admin.
- **Firestore collections**: `drinks`, `orders`, `users/{uid}`, `config/app`, `rateLimits/{uid}`
- **Hosting**: serves `web/dist/`
- **Storage**: drink photo assets
- **FCM**: push notifications for order events

### Auth & admin model
All users start anonymous. The admin is identified by matching `auth.uid === config/app.adminUid` — this is set at seed time. `AdminGuard` (wrapping all `/admin/*` routes) handles the anonymous→Google link flow and shows the UID hint when a non-admin Google account signs in. There is no roles system — single admin UID stored in Firestore.

### Cloud Functions

| Function | Trigger | Purpose |
|---|---|---|
| `createOrder` | HTTPS Callable | The ONLY way orders are created (client create is denied by rules). Validates bar open + door password (`config/private.barPassword`, staff-only read; normalized case/punct-insensitive) + per-guest throttle (max 3 active, 6 per 10 min), snapshots `partyMode`, persists guest `displayName` |
| `onOrderCreate` | Firestore write `orders/*` | Push FCM to all staff (admin + guest bartenders) |
| `onOrderStatusChange` | Firestore update `orders/*` | Push FCM to guest when status → `ready` (only if `partyMode: true`); staff push on guest cancel |
| `recommendDrink` | HTTPS Callable | Claude AI recommendation — requires Google auth (not anonymous), 10 req/hour rate limit |
| `generateDrinkRecipe` | HTTPS Callable | Claude (Sonnet) invents a full recipe from a free-text/spoken request (staff only) |
| `generateDrinkImage` | HTTPS Callable | gpt-image-1 drink photo; accepts an optional full `prompt` override (staff only, `OPENAI_API_KEY` secret) |
| `generateDrinkDescription` | HTTPS Callable | Claude AI drink description generation (staff only) |
| `seedMenu` | HTTPS Callable | Seed drinks from admin UI (staff only) |
| `createBartenderInvite` / `claimBartenderInvite` | HTTPS Callable | Guest bartender invite codes (see Staff section) |
| `sendTestPush` | HTTPS Callable | Staff self-test of the full push pipeline |

`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are Firebase Secrets accessed via `{ secrets: [...] }` on callable functions (emulator values in `functions/.secret.local`). The Anthropic model constants (`SONNET`, `HAIKU`) are defined in `functions/src/lib/anthropic.ts`.

### Ordering access (door password)
Opening the bar generates a fun two-word password stored in `config/private.barPassword` (staff-only read — NEVER put it on `config/app`, which is publicly readable). It's shown in the admin queue and via the QR icon in the guest nav (staff only), both encoding `/?pw=…`. Guests scan (auto-stored via GuestLayout → localStorage `speakeasy.barPassword`) or type it when prompted on their first order; `createOrder` rejects with `permission-denied` on a wrong/missing password. Admins can regenerate or set a custom password while open. Closing the bar nulls the password. There is no geolocation anywhere.

### Data model
Schema source of truth is `web/src/lib/schema.ts` (Zod schemas for `Drink`, `Order`, `UserProfile`, `AppConfig`). Functions do **not** import from `web/` — they declare their own inline types for Firestore data.

Order status flow: `received → viewed → making → ready → delivered`

Staff claiming: the first staff member to advance an order stamps `claimedBy`/`claimedByName` on it; the queue shows "You're on it" / "<name> is on it" so co-bartenders don't double-make drinks.

### Rate limiting
`functions/src/lib/rateLimiter.ts`: 10 AI recommendation calls per user per hour. Uses a Firestore transaction on `rateLimits/{uid}` with a per-instance in-memory cache (60s TTL) to reduce Firestore reads.

### FCM push architecture
- **All tokens (admin included)**: stored on the user's own `users/{uid}.fcmDevices[]` as `{ token, label, addedAt }` (label = "iPhone · Safari" style, parsed from UA). Legacy bare `fcmTokens[]` arrays are still merged at send time (`tokensFromUserData`). Never store tokens on `config/app` — it's publicly readable.
- Registration is gesture-gated (`enableNotifications()` in `useFcmToken`); with permission already granted it silently re-registers on load unless the device was removed (localStorage `speakeasy.pushDisabled` opt-out). Device upserts/removals MUST read the list via `getDoc` first — writing from the hook's subscription snapshot clobbers other devices' registrations.
- `NotificationDevices` (on `/me` and the admin queue) lists devices with per-device removal and won't-get-notifications warnings.
- Pushes are **data-only** (`data: { title, body, ... }`) — a `notification` payload would be auto-displayed by the SDK on top of the SW handler, duplicating notifications
- **One service worker** (`web/src/sw.ts`, built by vite-plugin-pwa injectManifest into `dist/sw.js`): Workbox precache + SPA navigation route + FCM `onBackgroundMessage` + notificationclick → `/orders/{id}`. Registered at app load by `UpdateToast` (`useRegisterSW`, `registerType: 'prompt'` — new deploys show an update toast)
- The app is an installable PWA (manifest generated in `vite.config.ts`; apple-touch-icon + iOS metas in index.html; `/sw.js` served with no-cache via firebase.json headers)

### Staff / guest bartenders
`config/app.bartenderUids[]` (+ `bartenderNames{}`) grants temporary staff access: admin UI (`AdminGuard`/rules/`assertStaff` all check admin-or-bartender), bar-ops config writes (not the staff/token lists), and order pushes via `sendPushToStaff`. Invite flow: admin's Staff card → `createBartenderInvite` callable → 6-char single-use code (24h) → invitee signs in with Google at `/bartender` → `claimBartenderInvite`. Closing the bar clears the bartender list.

### Local development notes
The web app auto-connects to emulators when `import.meta.env.DEV` is true. The emulator project ID is `demo-speakeasy`. Firestore rules tests (`test:rules`) require the Firestore emulator to already be running on port 8080.

### Design system
Dark theme (`#0a0a0a` background, `#c9a96e` gold primary). Typography: Inter (body) + Cormorant (headings). Defined in `web/src/theme.ts`.

### Testing conventions
- Every test file in `web/src/__tests__/` must `vi.mock('../../lib/firebase', ...)` at the top — `firebase.ts` runs side effects on import.
- Use `vi.hoisted()` when mock variables are referenced inside `vi.mock()` factory functions (avoids "cannot access before initialization" errors).
- Visual regression baselines (`web/e2e/snapshots/`) must be generated on the CI Ubuntu runner, not macOS — font rendering differs. Use `--update-snapshots` on a branch to regenerate.
