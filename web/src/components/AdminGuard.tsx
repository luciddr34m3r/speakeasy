import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, linkWithPopup, signInWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../hooks/useAppConfig';

interface AdminGuardProps {
  children: ReactNode;
}

const provider = new GoogleAuthProvider();

export default function AdminGuard({ children }: AdminGuardProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { config, loading: configLoading } = useAppConfig();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  if (authLoading || configLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  const isStaff =
    user && !user.isAnonymous && config &&
    (user.uid === config.adminUid || (config.bartenderUids ?? []).includes(user.uid));

  if (isStaff) return <>{children}</>;

  // Popup (not redirect) sign-in — see SignIn.tsx for why redirects break here
  const handleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      if (user?.isAnonymous) {
        await linkWithPopup(user, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
      // Auth state updates automatically; the guard re-evaluates isAdmin
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]);
        if (credential) await signInWithCredential(auth, credential);
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(err instanceof Error ? err.message : 'Sign-in failed.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const showUidHint = user && !user.isAnonymous && config && user.uid !== config.adminUid;

  return (
    <Box sx={{ textAlign: 'center', mt: 12, px: 3 }}>
      <Typography variant="h5" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
        Staff only.
      </Typography>

      {showUidHint ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Signed in as <strong>{user.email}</strong> but this account isn't the admin.
          </Typography>
          {import.meta.env.DEV && (
            <>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2, fontFamily: 'monospace', bgcolor: 'rgba(255,255,255,0.04)', p: 1, borderRadius: 1 }}>
                Your UID: {user.uid}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Update <code>adminUid</code> in <code>scripts/seed-emulator.mjs</code> to this value, re-run the script, then reload.
              </Typography>
            </>
          )}
        </Box>
      ) : (
        <>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            Sign in with the bartender's Google account to continue.
          </Typography>
          <Button
            variant="outlined"
            onClick={handleSignIn}
            disabled={signingIn}
            sx={{ borderColor: 'primary.main', color: 'primary.main' }}
            startIcon={signingIn ? <CircularProgress size={16} sx={{ color: 'primary.main' }} /> : null}
          >
            {signingIn ? 'Signing in…' : 'Sign in with Google'}
          </Button>
          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 2 }}>
              {error}
            </Typography>
          )}
        </>
      )}

      <Box sx={{ mt: 4 }}>
        <Button variant="text" onClick={() => navigate('/')} sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
          ← Back to menu
        </Button>
      </Box>
    </Box>
  );
}
