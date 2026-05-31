// Firebase Cloud Messaging service worker.
// This file must be at the root path and is served by Firebase Hosting.
// It is NOT processed by Vite — keep it as plain JS.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// These values are replaced at deploy time via a separate script or env substitution.
// For local emulator testing, background push notifications won't fire anyway.
firebase.initializeApp({
  apiKey: __FIREBASE_API_KEY__ || 'demo-key',
  authDomain: __FIREBASE_AUTH_DOMAIN__ || 'demo-speakeasy.firebaseapp.com',
  projectId: __FIREBASE_PROJECT_ID__ || 'demo-speakeasy',
  storageBucket: __FIREBASE_STORAGE_BUCKET__ || 'demo-speakeasy.appspot.com',
  messagingSenderId: __FIREBASE_MESSAGING_SENDER_ID__ || '000000000000',
  appId: __FIREBASE_APP_ID__ || '1:000000000000:web:000000000000',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'Speakeasy', {
    body: body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: payload.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = event.notification.data?.orderId;
  const url = orderId ? `/orders/${orderId}` : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
