import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { Order } from '../lib/schema';

const ACTIVE_STATUSES = new Set(['received', 'viewed', 'making', 'ready']);

/**
 * The guest's newest in-flight order, or null. Queries by guestUid+createdAt
 * (composite index already deployed) and filters status client-side — a
 * status-in query would need a new three-field index for five documents.
 */
export function useActiveOrder(): { activeOrder: Order | null; loading: boolean } {
  const { user } = useAuth();

  const q = user
    ? query(
        collection(db, 'orders'),
        where('guestUid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5),
      )
    : null;
  const [snap, loading] = useCollection(q);

  const activeOrder =
    (snap?.docs ?? [])
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
      .find((o) => ACTIVE_STATUSES.has(o.status)) ?? null;

  return { activeOrder, loading };
}
