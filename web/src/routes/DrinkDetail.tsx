import { useState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirebaseError } from 'firebase/app';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { useTheme } from '@mui/material/styles';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../hooks/useAppConfig';
import { useGuestName } from '../hooks/useGuestName';
import { getStoredBarPassword, storeBarPassword } from '../lib/barPassword';
import type { Drink } from '../lib/schema';

export default function DrinkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useAppConfig();
  const { custom } = useTheme();
  const { savedName, saveName } = useGuestName();
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [note, setNote] = useState('');
  const [password, setPassword] = useState(() => getStoredBarPassword());
  const [needPassword, setNeedPassword] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [drink, loading] = useDocumentData(doc(db, 'drinks', id ?? '_'));
  const typedDrink = drink as Omit<Drink, 'id'> | undefined;
  const barOpen = config?.barOpen ?? false;
  const guestName = nameInput ?? savedName;
  const showNameField = editingName || !savedName;

  const handleOrder = async () => {
    if (!guestName.trim() || !user || !typedDrink || !id) return;
    setOrdering(true);
    setOrderError(null);
    try {
      const call = httpsCallable<
        { drinkId: string; guestName: string; password?: string; note?: string },
        { orderId: string }
      >(functions, 'createOrder');
      const result = await call({
        drinkId: id,
        guestName: guestName.trim(),
        ...(password.trim() ? { password: password.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      storeBarPassword(password.trim());
      await saveName(guestName);
      navigate(`/orders/${result.data.orderId}`);
    } catch (err) {
      if (err instanceof FirebaseError && err.code === 'functions/failed-precondition') {
        setOrderError('The bar is closed right now.');
      } else if (err instanceof FirebaseError && err.code === 'functions/permission-denied') {
        setNeedPassword(true);
        setOrderError(needPassword || password.trim()
          ? 'That’s not tonight’s password — check with the bartender. 🤫'
          : 'This bar has a door password — ask the bartender or scan the QR at the bar. 🤫');
      } else if (err instanceof FirebaseError && err.code === 'functions/resource-exhausted') {
        setOrderError(err.message);
      } else {
        setOrderError('Something went wrong placing your order. Try again.');
      }
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!typedDrink) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Typography color="text.secondary">Drink not found.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <IconButton onClick={() => navigate('/')} sx={{ mb: 2, color: 'primary.main' }}>
        <ArrowBackIcon />
      </IconButton>

      {/* Hero image or placeholder */}
      {typedDrink.photoPath ? (
        <Box
          component="img"
          src={typedDrink.photoPath}
          alt={typedDrink.name}
          sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 1, mb: 3 }}
        />
      ) : (
        <Box
          sx={{
            height: 180,
            background: custom.placeholderGradient,
            borderRadius: 1,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontSize: '4rem', opacity: 0.3 }}>{custom.placeholderEmoji}</Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h3" sx={{ flexGrow: 1 }}>
          {typedDrink.name}
        </Typography>
        <Chip
          label={typedDrink.category}
          size="small"
          variant="outlined"
          sx={{ borderColor: 'primary.dark', color: 'primary.main', fontSize: '0.65rem' }}
        />
      </Box>

      {typedDrink.description && (
        <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
          {typedDrink.description}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.15em', fontSize: '0.65rem' }}>
        Ingredients
      </Typography>
      <Box component="ul" sx={{ mt: 1, mb: 3, pl: 2 }}>
        {typedDrink.ingredients.map((ing, i) => (
          <Typography key={i} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {ing}
          </Typography>
        ))}
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Order section */}
      {showNameField ? (
        <>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.15em', fontSize: '0.65rem', display: 'block', mb: 1.5 }}>
            Your Name
          </Typography>
          <TextField
            fullWidth
            placeholder="So the bartender knows who you are"
            value={guestName}
            onChange={(e) => setNameInput(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            slotProps={{ htmlInput: { maxLength: 40 } }}
          />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ordering as <Box component="strong" sx={{ color: 'primary.main' }}>{guestName}</Box>
          {' · '}
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => setEditingName(true)}
            sx={{ verticalAlign: 'baseline' }}
          >
            Change
          </Link>
        </Typography>
      )}
      <TextField
        fullWidth
        placeholder="Special request? (optional — e.g. no egg white, less sweet)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        slotProps={{ htmlInput: { maxLength: 120 } }}
      />
      {needPassword && (
        <TextField
          fullWidth
          label="What's the password? 🤫"
          placeholder="Ask the bartender or scan the QR at the bar"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="small"
          sx={{ mb: 2 }}
          slotProps={{ htmlInput: { maxLength: 40 } }}
        />
      )}
      {orderError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setOrderError(null)}>
          {orderError}
        </Alert>
      )}
      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        disabled={!guestName.trim() || ordering || !barOpen}
        onClick={handleOrder}
        sx={{ py: 1.5 }}
      >
        {ordering ? <CircularProgress size={22} sx={{ color: 'inherit' }} /> : 'Place Order'}
      </Button>
      {!barOpen && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          The bar is closed — ordering opens when the bartender&apos;s behind the bar.
        </Typography>
      )}
      {user?.isAnonymous && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          Want order history and recommendations?{' '}
          <Link component={RouterLink} to="/signin" underline="hover">
            Sign in with Google
          </Link>
        </Typography>
      )}
    </Container>
  );
}
