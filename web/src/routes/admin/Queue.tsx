import { useState } from 'react';
import { useFcmToken } from '../../hooks/useFcmToken';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { collection, query, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { db } from '../../lib/firebase';
import { useAppConfig } from '../../hooks/useAppConfig';
import AdminGuard from '../../components/AdminGuard';
import AdminNav from '../../components/AdminNav';
import type { Order, OrderStatus } from '../../lib/schema';

const STATUS_COLORS: Record<OrderStatus, 'default' | 'warning' | 'info' | 'success' | 'secondary'> = {
  received: 'warning',
  viewed: 'info',
  making: 'info',
  ready: 'success',
  delivered: 'secondary',
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  received: 'viewed',
  viewed: 'making',
  making: 'ready',
  ready: 'delivered',
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  received: 'Mark Seen',
  viewed: 'Start Making',
  making: 'Mark Ready',
  ready: 'Delivered',
};

export default function AdminQueue() {
  return (
    <AdminGuard>
      <AdminQueueContent />
    </AdminGuard>
  );
}

function AdminQueueContent() {
  const { token: fcmToken, permissionDenied } = useFcmToken(true);
  const { config, loading: configLoading } = useAppConfig();
  const [updatingPartyMode, setUpdatingPartyMode] = useState(false);

  const activeQ = query(
    collection(db, 'orders'),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  const [snap, ordersLoading] = useCollection(activeQ);
  const orders = (snap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
  const activeOrders = orders.filter((o) => o.status !== 'delivered');
  const recentDelivered = orders.filter((o) => o.status === 'delivered').slice(0, 5);

  const togglePartyMode = async () => {
    if (!config) return;
    setUpdatingPartyMode(true);
    await updateDoc(doc(db, 'config', 'app'), { partyMode: !config.partyMode });
    setUpdatingPartyMode(false);
  };

  const advance = async (orderId: string, currentStatus: OrderStatus) => {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    const updates: Record<string, unknown> = { status: next };
    if (currentStatus === 'received') updates.viewedAt = serverTimestamp();
    if (next === 'ready') updates.readyAt = serverTimestamp();
    if (next === 'delivered') updates.deliveredAt = serverTimestamp();
    await updateDoc(doc(db, 'orders', orderId), updates);
  };

  return (
    <>
      <AdminNav />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Notification status */}
        {permissionDenied && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Push notifications are blocked. Open your browser site settings and allow notifications for this site, then reload.
          </Alert>
        )}
        {!permissionDenied && !fcmToken && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Waiting for notification permission… If no prompt appeared, check that notifications are not blocked for this site in your browser settings.
          </Alert>
        )}

        {/* Party Mode toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, p: 2, border: '1px solid rgba(201,169,110,0.2)', borderRadius: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">
              Party Mode
              {config?.partyMode && (
                <Chip label="ON" size="small" color="success" sx={{ ml: 1, fontSize: '0.6rem' }} />
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              When on, guests get a push notification when their drink is ready.
            </Typography>
          </Box>
          {configLoading || updatingPartyMode ? (
            <CircularProgress size={24} sx={{ color: 'primary.main' }} />
          ) : (
            <FormControlLabel
              control={
                <Switch
                  checked={config?.partyMode ?? false}
                  onChange={togglePartyMode}
                  sx={{ '& .MuiSwitch-thumb': { color: config?.partyMode ? 'success.main' : undefined } }}
                />
              }
              label=""
            />
          )}
        </Box>

        <Typography variant="h4" sx={{ mb: 3 }}>
          Active Orders
          {activeOrders.length > 0 && (
            <Chip label={activeOrders.length} size="small" color="warning" sx={{ ml: 1, verticalAlign: 'middle' }} />
          )}
        </Typography>

        {ordersLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress sx={{ color: 'primary.main' }} />
          </Box>
        ) : activeOrders.length === 0 ? (
          <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No active orders. Enjoy the quiet.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {activeOrders.map((order) => (
              <Grid key={order.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <OrderCard order={order} onAdvance={() => advance(order.id, order.status)} />
              </Grid>
            ))}
          </Grid>
        )}

        {recentDelivered.length > 0 && (
          <>
            <Divider sx={{ my: 4 }} />
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.15em', fontSize: '0.65rem' }}>
              Recently Delivered
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recentDelivered.map((order) => (
                <Box key={order.id} sx={{ display: 'flex', gap: 2, opacity: 0.5 }}>
                  <Typography variant="body2">{order.drinkName}</Typography>
                  <Typography variant="caption" color="text.secondary">→ {order.guestName}</Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Container>
    </>
  );
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: () => void }) {
  const [advancing, setAdvancing] = useState(false);
  const next = NEXT_STATUS[order.status];

  const handleAdvance = async () => {
    setAdvancing(true);
    await onAdvance();
    setAdvancing(false);
  };

  const age = order.createdAt
    ? Math.round((Date.now() - (order.createdAt as { toMillis(): number }).toMillis()) / 60000)
    : null;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h5" sx={{ lineHeight: 1.2 }}>{order.drinkName}</Typography>
          <Chip
            label={order.status}
            size="small"
            color={STATUS_COLORS[order.status]}
            sx={{ textTransform: 'capitalize', fontSize: '0.65rem', ml: 1, flexShrink: 0 }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">{order.guestName}</Typography>
        {age !== null && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
            {age === 0 ? 'just now' : `${age}m ago`}
          </Typography>
        )}
      </CardContent>
      {next && (
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={handleAdvance}
            disabled={advancing}
          >
            {advancing ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : NEXT_LABEL[order.status]}
          </Button>
        </CardActions>
      )}
    </Card>
  );
}
