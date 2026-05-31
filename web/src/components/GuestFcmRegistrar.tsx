import { useFcmToken } from '../hooks/useFcmToken';

// Silently registers FCM token for Google-signed-in guests so they can
// receive "your drink is ready" push notifications when Party Mode is on.
export default function GuestFcmRegistrar() {
  useFcmToken(false); // isAdmin=false; skips anon users inside the hook
  return null;
}
