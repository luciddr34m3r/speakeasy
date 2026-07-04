import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useFcmToken } from '../hooks/useFcmToken';

/**
 * Contextual, dismissible offer to enable push notifications. Rendered after a
 * guest places an order — the moment a ping is actually useful to them.
 */
export default function NotificationPrompt() {
  const { supported, permission, enableNotifications } = useFcmToken();
  const [dismissed, setDismissed] = useState(false);

  if (!supported || permission !== 'default' || dismissed) return null;

  return (
    <Alert
      severity="info"
      icon={false}
      onClose={() => setDismissed(true)}
      sx={{ mt: 4, textAlign: 'left', alignItems: 'center' }}
      action={
        <Button size="small" onClick={enableNotifications} sx={{ whiteSpace: 'nowrap' }}>
          Enable
        </Button>
      }
    >
      Want a ping when your drink is ready?
    </Alert>
  );
}
