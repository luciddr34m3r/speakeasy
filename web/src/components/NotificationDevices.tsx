import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useFcmToken } from '../hooks/useFcmToken';

/**
 * Notification status + registered-device management for the current user.
 * Shown on /me for everyone and on the admin queue for staff.
 */
export default function NotificationDevices() {
  const {
    supported, permission, permissionDenied, token, error,
    devices, optedOut, enableNotifications, removeDevice,
  } = useFcmToken();

  if (supported === false) return null;

  return (
    <Box sx={{ mb: 3 }}>
      {permissionDenied && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Notifications are blocked in your browser settings — this device won&apos;t get order updates until you allow them and reload.
        </Alert>
      )}
      {!permissionDenied && error && (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          action={
            <Button size="small" onClick={enableNotifications} sx={{ whiteSpace: 'nowrap' }}>
              Retry
            </Button>
          }
        >
          Notification setup failed: {error}
        </Alert>
      )}
      {!permissionDenied && !error && (permission === 'default' || optedOut) && (
        <Alert
          severity="info"
          sx={{ mb: 1.5 }}
          action={
            <Button size="small" onClick={enableNotifications} sx={{ whiteSpace: 'nowrap' }}>
              Enable
            </Button>
          }
        >
          This device won&apos;t get notifications — enable them to get order updates here.
        </Alert>
      )}

      {devices.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.15em', fontSize: '0.6rem' }}>
            Notification devices
          </Typography>
          <Box sx={{ mt: 0.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {devices.map((device) => (
              <Chip
                key={device.token}
                label={device.token === token ? `${device.label} (this device)` : device.label}
                onDelete={() => removeDevice(device.token)}
                variant="outlined"
                size="small"
                sx={{ borderColor: device.token === token ? 'primary.main' : 'divider' }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
            Removing a device stops its notifications. Other devices re-register if the app is opened there with notifications still allowed.
          </Typography>
        </>
      )}
    </Box>
  );
}
