import { useState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useGuestName } from '../hooks/useGuestName';

/**
 * Landing page for guest bartender invites: sign in with Google, enter the
 * code the host gave you, and you're behind the bar.
 */
export default function BartenderClaim() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { savedName, saveName } = useGuestName();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const name = nameInput ?? (savedName || user?.displayName || '');

  const needsSignIn = !authLoading && (!user || user.isAnonymous);

  const handleClaim = async () => {
    setClaiming(true);
    setError('');
    try {
      const fn = httpsCallable<{ code: string; name: string }, { ok: boolean }>(functions, 'claimBartenderInvite');
      await fn({ code: code.trim().toUpperCase(), name: name.trim() });
      await saveName(name);
      navigate('/admin');
    } catch (err: unknown) {
      const errCode = (err as { code?: string }).code;
      setError(
        errCode === 'functions/not-found'
          ? "That code isn't valid — double-check it with the host."
          : errCode === 'functions/failed-precondition'
            ? 'That invite has expired — ask the host for a fresh one.'
            : 'Could not claim the invite. Try again.',
      );
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="h3" sx={{ color: 'primary.main', mb: 1 }}>
        Behind the Bar
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Got an invite from the host? Enter your code to join as a guest bartender —
        you&apos;ll get the order queue, bar controls, and order notifications.
      </Typography>

      {needsSignIn ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            First, sign in with Google so the host knows who&apos;s pouring.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/signin?next=${encodeURIComponent(`/bartender?code=${code}`)}`)}
          >
            Sign in with Google
          </Button>
        </>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Your name"
            placeholder="What the guests will see"
            value={name}
            onChange={(e) => setNameInput(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 40 } }}
          />
          <TextField
            label="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            slotProps={{ htmlInput: { maxLength: 6, style: { letterSpacing: '0.3em', textAlign: 'center' } } }}
          />
          {error && <Alert severity="warning">{error}</Alert>}
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleClaim}
            disabled={code.trim().length < 6 || !name.trim() || claiming}
          >
            {claiming ? <CircularProgress size={22} sx={{ color: 'inherit' }} /> : 'Start my shift'}
          </Button>
        </Box>
      )}

      <Button variant="text" onClick={() => navigate('/')} sx={{ mt: 4, color: 'text.disabled', fontSize: '0.75rem' }}>
        ← Back to menu
      </Button>
    </Container>
  );
}
