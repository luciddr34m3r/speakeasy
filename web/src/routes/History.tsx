import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { collection, query, where, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Order, UserProfile } from '../lib/schema';

export default function History() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [profileData] = useDocumentData(user && !user.isAnonymous ? doc(db, 'users', user.uid) : null);
  const profile = profileData as Omit<UserProfile, 'id'> | undefined;

  const ordersQ = user && !user.isAnonymous
    ? query(collection(db, 'orders'), where('guestUid', '==', user.uid), orderBy('createdAt', 'desc'))
    : null;
  const [ordersSnap, ordersLoading] = useCollection(ordersQ);
  const orders = (ordersSnap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));

  const rate = async (drinkId: string, rating: 1 | -1) => {
    if (!user || user.isAnonymous) return;
    const userRef = doc(db, 'users', user.uid);
    const current = profile?.ratings?.[drinkId];
    // Toggle off if same rating, otherwise set new rating
    const newVal = current === rating ? null : rating;
    const newRatings = { ...(profile?.ratings ?? {}) };
    if (newVal === null) delete newRatings[drinkId];
    else newRatings[drinkId] = newVal;

    if (profile) {
      await updateDoc(userRef, { ratings: newRatings });
    } else {
      await setDoc(userRef, { displayName: user.displayName ?? '', isGoogleLinked: true, ratings: newRatings, fcmTokens: [] }, { merge: true });
    }
  };

  if (authLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress sx={{ color: 'primary.main' }} /></Box>;
  }

  if (!user || user.isAnonymous) {
    return (
      <Container maxWidth="xs" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Sign in to see your history</Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Create an account to save your order history and rate drinks.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => navigate('/signin')}>
          Sign In with Google
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
        <Typography variant="h4">Your Orders</Typography>
      </Box>

      {ordersLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      ) : orders.length === 0 ? (
        <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No orders yet. Head to the menu!
        </Typography>
      ) : (
        <List disablePadding>
          {orders.map((order, i) => {
            const rating = profile?.ratings?.[order.drinkId];
            return (
              <Box key={order.id}>
                <ListItem
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => rate(order.drinkId, 1)}
                        sx={{ color: rating === 1 ? 'primary.main' : 'text.disabled' }}
                      >
                        <ThumbUpIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => rate(order.drinkId, -1)}
                        sx={{ color: rating === -1 ? 'error.main' : 'text.disabled' }}
                      >
                        <ThumbDownIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                  sx={{ px: 0 }}
                >
                  <ListItemText
                    primary={order.drinkName}
                    secondary={
                      order.createdAt
                        ? new Date((order.createdAt as { toDate(): Date }).toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : ''
                    }
                    slotProps={{
                      primary: { sx: { fontFamily: '"Cormorant", serif', fontSize: '1.1rem' } },
                      secondary: { sx: { fontSize: '0.7rem' } },
                    }}
                  />
                </ListItem>
                {i < orders.length - 1 && <Divider />}
              </Box>
            );
          })}
        </List>
      )}
    </Container>
  );
}
