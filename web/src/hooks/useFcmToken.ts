import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, getDoc, setDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { getMessagingIfSupported, db } from '../lib/firebase';
import { useAuth } from './useAuth';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const OPT_OUT_KEY = 'speakeasy.pushDisabled';

export interface FcmDevice {
  token: string;
  label: string;
  addedAt: number;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const platform = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  return `${platform} · ${browser}`;
}

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * FCM registration + device management. Every user's tokens (admin included)
 * live on their own users/{uid}.fcmDevices with a human-readable label, so
 * the UI can list registered devices and remove them.
 *
 * The permission PROMPT stays behind a user gesture (enableNotifications).
 * When permission is already granted, the token silently re-registers on
 * load (tokens rotate; in-memory state resets every visit) — unless this
 * device was explicitly removed (localStorage opt-out).
 */
export function useFcmToken() {
  const { user } = useAuth();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optedOut, setOptedOut] = useState(isOptedOut);
  const registering = useRef(false);

  const [profileData] = useDocumentData(user ? doc(db, 'users', user.uid) : null);
  const devices = ((profileData?.fcmDevices as FcmDevice[] | undefined) ?? [])
    .slice()
    .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));

  useEffect(() => {
    let cancelled = false;
    getMessagingIfSupported().then((messaging) => {
      if (!cancelled) setSupported(Boolean(messaging) && Boolean(VAPID_KEY));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (): Promise<void> => {
    if (registering.current) return;
    registering.current = true;
    try {
      const messaging = await getMessagingIfSupported();
      setError(null);
      if (!messaging || !user || !VAPID_KEY) return;

      const sw = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Service worker never became ready — try reloading.')), 10000),
        ),
      ]);
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: sw,
      });
      if (!fcmToken) {
        setError('No notification token was issued — try again.');
        return;
      }
      setToken(fcmToken);

      // Upsert this device against a FRESH read — the hook's subscription
      // snapshot may not have arrived yet on page load, and writing from a
      // stale list clobbers every other device's registration
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const current = ((snap.data()?.fcmDevices as FcmDevice[] | undefined) ?? []).filter(
        (d) => d.token !== fcmToken,
      );
      await setDoc(
        userRef,
        { fcmDevices: [...current, { token: fcmToken, label: deviceLabel(), addedAt: Date.now() }] },
        { merge: true },
      );
    } catch (err) {
      console.warn('FCM token registration failed:', err);
      setError(err instanceof Error ? err.message : 'Notification setup failed.');
    } finally {
      registering.current = false;
    }
    // devices is derived from a live subscription; deliberately not a dep to
    // avoid re-register loops — the latest snapshot is read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Permission already granted (this or a past visit): refresh the token
  // silently — unless the user removed this device on purpose. Deferred a
  // tick so no setState runs synchronously inside the effect.
  useEffect(() => {
    if (supported && permission === 'granted' && user && !token && !optedOut) {
      const timer = setTimeout(() => {
        void register();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [supported, permission, user, token, optedOut, register]);

  const enableNotifications = useCallback(async () => {
    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging || !user || !VAPID_KEY) return;

      try {
        localStorage.removeItem(OPT_OUT_KEY);
      } catch { /* private browsing */ }
      setOptedOut(false);

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return;

      await register();
    } catch (err) {
      console.warn('FCM enable failed:', err);
      setError(err instanceof Error ? err.message : 'Notification setup failed.');
    }
  }, [user, register]);

  const removeDevice = useCallback(
    async (deviceToken: string) => {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const remaining = ((snap.data()?.fcmDevices as FcmDevice[] | undefined) ?? []).filter(
        (d) => d.token !== deviceToken,
      );
      await updateDoc(userRef, {
        fcmDevices: remaining,
        // Prune legacy array entries too
        fcmTokens: arrayRemove(deviceToken),
      });
      if (deviceToken === token) {
        try {
          localStorage.setItem(OPT_OUT_KEY, '1');
        } catch { /* private browsing */ }
        setOptedOut(true);
        setToken(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, profileData],
  );

  // In-app foreground message handler — pushes are data-only, and
  // notifications must go through the SW registration (the bare Notification
  // constructor throws on Android Chrome).
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    getMessagingIfSupported().then((messaging) => {
      if (!messaging || cancelled) return;
      unsubscribe = onMessage(messaging, async (payload) => {
        const { title, body, orderId } = payload.data ?? {};
        if (title && Notification.permission === 'granted') {
          const sw = await navigator.serviceWorker.ready;
          await sw.showNotification(title, {
            body,
            icon: '/icons/icon-192.png',
            data: { orderId },
          });
        }
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return {
    supported,
    permission,
    permissionDenied: permission === 'denied',
    token,
    error,
    devices,
    optedOut,
    enableNotifications,
    removeDevice,
  };
}
