/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// ── App shell / precache ─────────────────────────────────────────────────────

// The update flow is user-driven: UpdateToast posts SKIP_WAITING when the
// guest taps "Update", so a new deploy never yanks the page out from under them.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    // Firebase reserved paths (/__/auth et al.) must hit the network
    denylist: [/^\/__\//],
  }),
);

// ── FCM background push ──────────────────────────────────────────────────────

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-speakeasy.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-speakeasy',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-speakeasy.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:000000000000:web:000000000000',
});

const messaging = getMessaging(app);

// Pushes are data-only (see functions/src/lib/fcm.ts) so this handler is the
// single display path — notification payloads would be auto-shown by the SDK
// on top of this, producing duplicates.
onBackgroundMessage(messaging, (payload) => {
  const { title, body, orderId } = payload.data ?? {};
  void self.registration.showNotification(title ?? 'Speakeasy', {
    body: body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { orderId },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = (event.notification.data as { orderId?: string } | undefined)?.orderId;
  const url = orderId ? `/orders/${orderId}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client
            .focus()
            .then((focused) => ('navigate' in focused ? focused.navigate(url) : undefined))
            .then(() => undefined);
        }
      }
      return self.clients.openWindow(url).then(() => undefined);
    }),
  );
});
