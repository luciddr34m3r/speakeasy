import { doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject, type StorageReference } from 'firebase/storage';
import { db, storage } from './firebase';

/**
 * photoPath holds one of two URL shapes:
 * - firebasestorage.googleapis.com download URLs (admin uploads) — the SDK
 *   parses these directly.
 * - storage.googleapis.com/<bucket>/<path> public URLs (the image-gen
 *   script) — the SDK can't parse these, so extract the object path.
 */
export function storageRefFromUrl(url: string): StorageReference {
  if (url.includes('storage.googleapis.com') && !url.includes('firebasestorage.googleapis.com')) {
    const { pathname } = new URL(url);
    const [, ...objectPath] = pathname.split('/').filter(Boolean); // drop the bucket segment
    return ref(storage, decodeURIComponent(objectPath.join('/')));
  }
  return ref(storage, url);
}

export async function deleteDrink(drink: { id: string; photoPath?: string | null }): Promise<void> {
  if (drink.photoPath) {
    try {
      await deleteObject(storageRefFromUrl(drink.photoPath));
    } catch {
      // A missing/foreign photo shouldn't block deleting the drink itself.
    }
  }
  await deleteDoc(doc(db, 'drinks', drink.id));
}
