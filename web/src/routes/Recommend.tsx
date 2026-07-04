import { useState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { alpha } from '@mui/material/styles';
import { useNavigate, Link } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useSpeechInput } from '../hooks/useSpeechInput';
import type { Drink } from '../lib/schema';

interface Recommendation {
  drinkId: string;
  drinkName: string;
  reason: string;
}

export default function Recommend() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rec, setRec] = useState<Recommendation | null>(null);
  const { supported, listening, startListening, stopListening } = useSpeechInput(setTranscript);

  const [recDrinkData] = useDocumentData(rec ? doc(db, 'drinks', rec.drinkId) : null);
  const recDrink = recDrinkData as Omit<Drink, 'id'> | undefined;

  // Load guest's ratings if signed in
  const [userProfileData] = useDocumentData(user && !user.isAnonymous ? doc(db, 'users', user.uid) : null);
  const ratings = (userProfileData as { ratings?: Record<string, number> } | undefined)?.ratings ?? {};

  const handleGetRecommendation = async () => {
    if (!transcript.trim()) {
      setError('Tell me what you\'re in the mood for first.');
      return;
    }
    setLoading(true);
    setError('');
    setRec(null);
    try {
      const fn = httpsCallable<{ transcript: string; ratings: Record<string, number> }, Recommendation>(
        functions,
        'recommendDrink',
      );
      const result = await fn({ transcript, ratings });
      setRec(result.data);
    } catch (err: unknown) {
      // Never surface raw SDK/model errors to guests
      const code = (err as { code?: string }).code;
      setError(
        code === 'functions/resource-exhausted'
          ? "You've hit the hourly limit — give it a little while."
          : "The bartender's AI is taking a break — try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Gate: require Google sign-in for AI recommendations
  if (!user || user.isAnonymous) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <IconButton onClick={() => navigate('/')} sx={{ color: 'primary.main' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">AI Recommendations</Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Describe what you&apos;re in the mood for and the bartender&apos;s AI will pick your drink.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in so recommendations can learn your taste — your thumbs-up history feeds the AI.
        </Typography>
        <Button
          variant="outlined"
          component={Link}
          to="/signin"
          sx={{ borderColor: 'primary.main', color: 'primary.main' }}
        >
          Sign in with Google
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => navigate('/')} sx={{ color: 'primary.main' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">What are you in the mood for?</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Describe your ideal drink — something bitter, citrusy, strong, sweet, or anything in between.
        Tap the mic or type it out.
      </Typography>

      {/* Voice input */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="e.g. something smoky and strong, not too sweet…"
        />
        {supported && (
          <IconButton
            onClick={listening ? stopListening : startListening}
            sx={{
              bgcolor: listening ? 'error.main' : 'primary.dark',
              color: 'white',
              mt: 0.5,
              '&:hover': { bgcolor: listening ? 'error.dark' : 'primary.main' },
            }}
          >
            {listening ? <StopIcon /> : <MicIcon />}
          </IconButton>
        )}
      </Box>

      {listening && (
        <Typography variant="caption" color="primary.main" sx={{ display: 'block', mb: 2 }}>
          Listening…
        </Typography>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        onClick={handleGetRecommendation}
        disabled={loading || !transcript.trim()}
        startIcon={loading ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <AutoAwesomeIcon />}
        sx={{ mb: 4 }}
      >
        {loading ? 'Thinking…' : 'Recommend a Drink'}
      </Button>

      {/* Recommendation result */}
      {rec && recDrink && (
        <Box
          sx={(t) => ({
            p: 3,
            border: '1px solid',
            borderColor: 'primary.main',
            borderRadius: 1,
            background: alpha(t.palette.primary.main, 0.06),
          })}
        >
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.2em', fontSize: '0.6rem' }}>
            Tonight, I suggest
          </Typography>
          <Typography variant="h4" sx={{ mt: 0.5, mb: 1 }}>
            {rec.drinkName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
            "{rec.reason}"
          </Typography>
          {recDrink.description && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2 }}>
              {recDrink.description}
            </Typography>
          )}
          <Divider sx={{ mb: 2 }} />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={() => navigate(`/drink/${rec.drinkId}`)}
          >
            See this drink →
          </Button>
        </Box>
      )}
    </Container>
  );
}
