import { useCallback, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'speakeasy.guestName';

/**
 * The guest's persisted name. Resolution order: Firestore profile (authoritative,
 * survives across devices for signed-in users), Google account displayName, then
 * localStorage (instant on load, survives anonymous-auth resets).
 */
export function useGuestName() {
  const { user } = useAuth();
  const [localName, setLocalName] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [profile] = useDocumentData(user ? doc(db, 'users', user.uid) : null);

  const savedName =
    ((profile?.displayName as string | undefined) ?? '') ||
    (user && !user.isAnonymous ? (user.displayName ?? '') : '') ||
    localName;

  const saveName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } catch {
        // Private browsing may block storage — the Firestore profile still persists it.
      }
      setLocalName(trimmed);
      if (user) {
        await setDoc(
          doc(db, 'users', user.uid),
          { displayName: trimmed, isGoogleLinked: !user.isAnonymous },
          { merge: true },
        );
      }
    },
    [user],
  );

  return { savedName, saveName };
}
