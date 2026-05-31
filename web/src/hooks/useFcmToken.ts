import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { messaging, db } from '../lib/firebase';
import { useAuth } from './useAuth';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function useFcmToken(isAdmin = false) {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!messaging || !user || !VAPID_KEY) return;
    // Don't register anonymous users — they can't receive named push notifications
    if (!isAdmin && user.isAnonymous) return;

    const register = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPermissionDenied(true);
          return;
        }

        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const sw = await navigator.serviceWorker.ready;

        const fcmToken = await getToken(messaging!, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: sw,
        });

        if (!fcmToken) return;
        setToken(fcmToken);

        // Store token — admin tokens go to config/app, guests go to their user profile
        if (isAdmin) {
          await updateDoc(doc(db, 'config', 'app'), {
            adminFcmTokens: arrayUnion(fcmToken),
          });
        } else if (!user.isAnonymous) {
          await updateDoc(doc(db, 'users', user.uid), {
            fcmTokens: arrayUnion(fcmToken),
          });
        }
      } catch (err) {
        console.warn('FCM token registration failed:', err);
      }
    };

    register();
  }, [user, isAdmin]);

  // In-app foreground message handler — show a browser notification manually
  useEffect(() => {
    if (!messaging) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification ?? {};
      if (title && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icons/icon-192.png' });
      }
    });
    return unsubscribe;
  }, []);

  return { token, permissionDenied };
}
