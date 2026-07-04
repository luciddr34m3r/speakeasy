import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import QRCode from 'qrcode';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';

/**
 * Big shareable QR + password for flashing at guests. Staff only (the
 * config/private read is rule-guarded).
 */
export default function ShareBarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [privateData] = useDocumentData(open ? doc(db, 'config', 'private') : null);
  const barPassword = (privateData?.barPassword as string | null | undefined) ?? null;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // No sync setState here (lint); rendering is gated on barPassword
    if (!barPassword) return;
    const url = `${window.location.origin}/?pw=${encodeURIComponent(barPassword)}`;
    QRCode.toDataURL(url, { width: 480, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [barPassword]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ textAlign: 'center', py: 4 }}>
        {barPassword ? (
          <>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.2em', fontSize: '0.65rem' }}>
              Scan to unlock ordering
            </Typography>
            {qrDataUrl && (
              <Box
                component="img"
                src={qrDataUrl}
                alt="Scan to unlock ordering"
                sx={{ width: '100%', maxWidth: 300, borderRadius: 2, border: '8px solid white', display: 'block', mx: 'auto', my: 2 }}
              />
            )}
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.2em', fontSize: '0.6rem' }}>
              or say the password 🤫
            </Typography>
            <Typography variant="h3" sx={{ color: 'primary.main', letterSpacing: '0.05em' }}>
              {barPassword}
            </Typography>
          </>
        ) : (
          <Typography color="text.secondary" sx={{ py: 3 }}>
            No door password is set — open the bar (or generate a password) from the admin page first.
          </Typography>
        )}
        <Button onClick={onClose} sx={{ mt: 3, color: 'text.secondary' }}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
