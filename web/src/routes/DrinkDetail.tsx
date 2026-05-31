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
import { useParams, useNavigate } from 'react-router-dom';
import { doc, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { Drink } from '../lib/schema';

const PLACEHOLDER_BG = 'linear-gradient(135deg, #1a1008 0%, #2a1a0a 100%)';

export default function DrinkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [ordering, setOrdering] = useState(false);

  const [drink, loading] = useDocumentData(doc(db, 'drinks', id ?? '_'));
  const typedDrink = drink as Omit<Drink, 'id'> | undefined;

  const handleOrder = async () => {
    if (!guestName.trim() || !user || !typedDrink) return;
    setOrdering(true);
    try {
      const configSnap = await getDoc(doc(db, 'config/app'));
      const partyMode = (configSnap.data()?.partyMode as boolean) ?? false;

      const orderRef = await addDoc(collection(db, 'orders'), {
        drinkId: id,
        drinkName: typedDrink.name,
        guestUid: user.uid,
        guestName: guestName.trim(),
        status: 'received',
        partyMode,
        createdAt: serverTimestamp(),
      });
      navigate(`/orders/${orderRef.id}`);
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
          sx={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 1, mb: 3 }}
        />
      ) : (
        <Box
          sx={{
            height: 180,
            background: PLACEHOLDER_BG,
            borderRadius: 1,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontSize: '4rem', opacity: 0.3 }}>🍸</Typography>
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
      <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.15em', fontSize: '0.65rem', display: 'block', mb: 1.5 }}>
        Your Name
      </Typography>
      <TextField
        fullWidth
        placeholder="So the bartender knows who you are"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        slotProps={{ htmlInput: { maxLength: 40 } }}
      />
      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        disabled={!guestName.trim() || ordering}
        onClick={handleOrder}
        sx={{ py: 1.5 }}
      >
        {ordering ? <CircularProgress size={22} sx={{ color: 'inherit' }} /> : `Order a ${typedDrink.name}`}
      </Button>
    </Container>
  );
}
