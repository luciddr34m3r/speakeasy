import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import NotificationDevices from '../components/NotificationDevices';
import { useNavigate } from 'react-router-dom';
import type { Order, UserProfile } from '../lib/schema';

export default function History() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Anonymous uids persist across visits, so their history is just as real
  const [profileData] = useDocumentData(user ? doc(db, 'users', user.uid) : null);
  const profile = profileData as Omit<UserProfile, 'id'> | undefined;

  const ordersQ = user
    ? query(collection(db, 'orders'), where('guestUid', '==', user.uid), orderBy('createdAt', 'desc'))
    : null;
  const [ordersSnap, ordersLoading] = useCollection(ordersQ);
  const orders = (ordersSnap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));

  const rate = async (drinkId: string, rating: 1 | -1) => {
    if (!user) return;
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
      await setDoc(
        userRef,
        {
          displayName: user.displayName ?? '',
          isGoogleLinked: !user.isAnonymous,
          ratings: newRatings,
          fcmTokens: [],
        },
        { merge: true },
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    // firebase.ts's auth listener signs the visitor back in anonymously
    navigate('/');
  };

  if (authLoading || !user) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress sx={{ color: 'primary.main' }} /></Box>;
  }

  const isGoogleUser = !user.isAnonymous;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')} sx={{ color: 'primary.main' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Your Orders</Typography>
      </Box>

      {isGoogleUser ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 3,
            p: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Signed in as <strong>{user.email}</strong>
          </Typography>
          <Button size="small" onClick={handleSignOut} sx={{ color: 'text.secondary', flexShrink: 0 }}>
            Sign out
          </Button>
        </Box>
      ) : (
        <Alert
          severity="info"
          icon={false}
          sx={{ mb: 3 }}
          action={
            <Button size="small" onClick={() => navigate('/signin')} sx={{ whiteSpace: 'nowrap' }}>
              Sign in
            </Button>
          }
        >
          Sign in with Google to keep your history across devices.
        </Alert>
      )}

      <NotificationDevices />

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
                        aria-label={`Thumbs up ${order.drinkName}`}
                        onClick={() => rate(order.drinkId, 1)}
                        sx={{ color: rating === 1 ? 'primary.main' : 'text.disabled' }}
                      >
                        <ThumbUpIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Thumbs down ${order.drinkName}`}
                        onClick={() => rate(order.drinkId, -1)}
                        sx={{ color: rating === -1 ? 'error.main' : 'text.disabled' }}
                      >
                        <ThumbDownIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                  sx={{ px: 0 }}
                  disablePadding
                >
                  <ListItemButton onClick={() => navigate(`/orders/${order.id}`)} sx={{ px: 0.5 }}>
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
                  </ListItemButton>
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
