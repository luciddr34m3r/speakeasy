import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import type { AppConfig } from '../lib/schema';

export function useAppConfig() {
  const [data, loading, error] = useDocumentData(doc(db, 'config', 'app'));
  return {
    config: data as AppConfig | undefined,
    loading,
    error,
  };
}
