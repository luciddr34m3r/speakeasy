import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the service worker and offers a one-tap refresh when a new
 * deploy is waiting. registerType is 'prompt', so nothing updates until the
 * guest opts in.
 */
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        icon={false}
        sx={{ alignItems: 'center' }}
        action={
          <>
            <Button size="small" onClick={() => updateServiceWorker(true)} sx={{ whiteSpace: 'nowrap' }}>
              Update
            </Button>
            <Button size="small" onClick={() => setNeedRefresh(false)} sx={{ color: 'text.secondary' }}>
              Later
            </Button>
          </>
        }
      >
        A new version is ready.
      </Alert>
    </Snackbar>
  );
}
