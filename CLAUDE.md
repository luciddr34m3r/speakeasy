# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| `createOrder` | HTTPS Callable | The ONLY way orders are created (client create is denied by rules). Validates bar open + door password (`config/app.barPassword`, normalized case/punct-insensitive) + per-guest throttle (max 3 active, 6 per 10 min), snapshots `partyMode`, persists guest `displayName` |
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
Opening the bar generates `config/app.barPassword` (fun two-word phrase) shown in the admin queue with a QR encoding `/?pw=…`. Guests scan (auto-stored via GuestLayout → localStorage `speakeasy.barPassword`) or type it when prompted on their first order; `createOrder` rejects with `permission-denied` on a wrong/missing password. Closing the bar nulls the password. There is no geolocation anywhere.

### Data model
Schema source of truth is `web/src/lib/schema.ts` (Zod schemas for `Drink`, `Order`, `UserProfile`, `AppConfig`). Functions do **not** import from `web/` — they declare their own inline types for Firestore data.

Order status flow: `received → viewed → making → ready → delivered`

### Rate limiting
`functions/src/lib/rateLimiter.ts`: 10 AI recommendation calls per user per hour. Uses a Firestore transaction on `rateLimits/{uid}` with a per-instance in-memory cache (60s TTL) to reduce Firestore reads.

### FCM push architecture
- **Guest + guest-bartender tokens**: stored in `users/{uid}.fcmTokens[]`, registered via the gesture-gated `enableNotifications()` in `useFcmToken` (NotificationPrompt on the order page; Queue for staff)
- **Admin tokens**: stored in `config/app.adminFcmTokens[]` (only the `adminUid` account writes there)
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
