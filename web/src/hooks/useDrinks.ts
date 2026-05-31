import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import type { Drink } from '../lib/schema';

export function useDrinks(adminView = false) {
  const q = adminView
    ? query(collection(db, 'drinks'), orderBy('name'))
    : query(collection(db, 'drinks'), where('available', '==', true), orderBy('name'));

  const [snapshot, loading, error] = useCollection(q);

  const drinks: Drink[] = (snapshot?.docs ?? []).map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Drink, 'id'>),
  }));

  return { drinks, loading, error };
}
