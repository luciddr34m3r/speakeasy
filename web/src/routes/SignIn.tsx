import { useState, useEffect } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { GoogleAuthProvider, signInWithRedirect, linkWithRedirect, signInWithCredential, getRedirectResult } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

const provider = new GoogleAuthProvider();

export default function SignIn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return;
        navigate('/');
      })
      .catch(async (err) => {
        if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(err);
          if (credential) {
            await signInWithCredential(auth, credential);
            navigate('/');
          }
        } else if (err.code !== 'auth/cancelled-popup-request') {
          setError(err.message ?? 'Sign-in failed.');
        }
      });
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      if (user?.isAnonymous) {
        await linkWithRedirect(user, provider);
      } else {
        await signInWithRedirect(auth, provider);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="h3" sx={{ color: 'primary.main', mb: 1 }}>
          The Speakeasy
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Sign in to unlock your order history, rate drinks, and get personalized recommendations.
        </Typography>
      </Box>

      <Button
        variant="outlined"
        fullWidth
        size="large"
        onClick={handleGoogleSignIn}
        disabled={loading}
        sx={{
          borderColor: 'primary.main',
          color: 'primary.main',
          py: 1.5,
          '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(201,169,110,0.05)' },
        }}
        startIcon={
          loading ? (
            <CircularProgress size={18} sx={{ color: 'primary.main' }} />
          ) : (
            <GoogleIcon />
          )
        }
      >
        {loading ? 'Signing in…' : 'Continue with Google'}
      </Button>

      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          {error}
        </Typography>
      )}

      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ display: 'block', textAlign: 'center', mt: 4 }}
      >
        You can also browse and order without signing in.
      </Typography>
    </Container>
  );
}

function GoogleIcon() {
  return (
    <Box
      component="svg"
      sx={{ width: 18, height: 18 }}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Box>
  );
}
