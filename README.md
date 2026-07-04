# 🥃 Speakeasy

A home-bar ordering app for house parties. Guests scan a QR code, browse the menu, and order drinks from their phones; whoever's behind the bar gets a push notification and works the queue. One host, optional guest bartenders, zero accounts required.

**Live app:** https://the-speakeasy-e3533.web.app

## How a party works

1. The host opens the bar from `/admin` — this generates a door password and QR code.
2. Guests scan the QR (or type the password once) and order straight from the menu. No sign-up: everyone gets an anonymous session, they just type a name.
3. Staff get a push for each order and advance it through `received → viewed → making → ready → delivered`. The first bartender to touch an order claims it, so nobody double-makes a drink.
4. With Party Mode on, guests get a push when their drink is ready.
5. Closing the bar burns the password and ends any guest-bartender shifts.

## Features

- **Installable PWA** — add-to-home-screen, offline shell, update toast on new deploys
- **Push notifications** — data-only FCM with per-device management (see and remove registered devices on `/me` or `/admin`)
- **Door password + QR** — server-validated, forgiving of typos (`velvet-eagle!` = `VELVET EAGLE`); per-guest order throttling keeps pranksters out
- **AI bartender** — guests describe what they want ("something smoky, no citrus") and Claude recommends from the actual menu; rate-limited per user and globally
- **AI drink builder** — staff describe a drink in free text; Claude writes the recipe and gpt-image-1 shoots the photo (fully editable prompt)
- **Guest bartenders** — single-use 24h invite codes give friends temporary staff access
- **Themes** — config-driven, applies live to every phone; includes a gloriously excessive July 4th mode 🦅

## Stack

| Layer | Tech |
|---|---|
| Web | React 19, Vite, TypeScript, MUI, react-router, vite-plugin-pwa |
| Backend | Firebase: Auth (anonymous + Google), Firestore, Cloud Functions v2 (Node 22), Hosting, Storage, FCM |
| AI | Anthropic Claude (recommendations, recipes, descriptions), OpenAI gpt-image-1 (photos) |
| Tests | Vitest (web + functions), @firebase/rules-unit-testing, Playwright |

## Development

```bash
npm install && npm install --prefix web && npm install --prefix functions

npm run emulate                     # all Firebase emulators (UI at :4000)
node scripts/seed-emulator.mjs      # sample menu + config (emulators running)
npm run dev                         # Vite dev server at :5173, auto-connects to emulators
```

AI features in the emulator need keys in `functions/.secret.local` (gitignored):

```
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

Web env lives in `web/.env.local` (dev) and `web/.env.production` (prod values, gitignored). See `web/.env.production.template`.

### Tests

```bash
npm run test --prefix web            # web unit tests
npm run test --prefix functions      # functions unit tests
npm run test:rules --prefix functions  # Firestore rules (needs emulator on :8080)
npm run test:e2e --prefix web        # Playwright
```

## CI/CD

Every push runs CI (typecheck, lint, unit tests, rules tests, build, e2e, Lighthouse). PRs get a Firebase preview-channel deploy with a URL comment. **Merging to `master` deploys to production automatically** — hosting, functions, and security rules.

Development follows branch → PR → green checks → merge. No direct pushes to `master`.

Required GitHub secrets: `FIREBASE_SERVICE_ACCOUNT`, the seven `VITE_FIREBASE_*` values, `ANTHROPIC_API_KEY` (issue-handler workflow), `CODECOV_TOKEN` (coverage upload). Server-side AI keys live in Firebase Secret Manager, not GitHub.

## Architecture notes

- **Orders are only created server-side** (`createOrder` callable) — Firestore rules deny client creates. That's where the password check, throttle, and drink validation live.
- **Secrets never live on `config/app`** — it's publicly readable so the theme renders before anonymous auth completes. The door password lives in `config/private` (staff-only read).
- **Push tokens live on each user's own doc** (`users/{uid}.fcmDevices`) with human-readable device labels. Pushes are data-only; a single service worker handles precache, FCM display, and notification clicks.
- **Single admin by UID** (`config/app.adminUid`, set at seed time) plus temporary `bartenderUids` — no roles system.

See [CLAUDE.md](CLAUDE.md) for the full command reference and conventions.
