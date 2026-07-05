import { useEffect, useState, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import { collection, query, orderBy, limit, doc, updateDoc, setDoc, serverTimestamp, arrayRemove, deleteField } from 'firebase/firestore';
import { useCollection, useDocumentData } from 'react-firebase-hooks/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useDrinks } from '../../hooks/useDrinks';
import AdminGuard from '../../components/AdminGuard';
import NotificationDevices from '../../components/NotificationDevices';
import AdminNav from '../../components/AdminNav';
import type { Drink, Order, OrderStatus, ThemeName } from '../../lib/schema';

// Speakeasy door passwords: adjective + creature, easy to shout across a party
const PASSWORD_ADJECTIVES = ['VELVET', 'SMOKY', 'GOLDEN', 'MIDNIGHT', 'DAPPER', 'CRIMSON', 'LUCKY', 'SASSY', 'ROWDY', 'SILKY'];
const PASSWORD_NOUNS = ['EAGLE', 'PANTHER', 'WALRUS', 'FLAMINGO', 'BANDIT', 'TIGER', 'RACCOON', 'MUSTANG', 'PENGUIN', 'FOX'];

function generateBarPassword(): string {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
  return `${pick(PASSWORD_ADJECTIVES)} ${pick(PASSWORD_NOUNS)}`;
}

const STATUS_COLORS: Record<OrderStatus, 'default' | 'warning' | 'info' | 'success' | 'secondary'> = {
  received: 'warning',
  viewed: 'info',
  making: 'info',
  ready: 'success',
  delivered: 'secondary',
  cancelled: 'default',
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
  const { token: fcmToken, supported } = useFcmToken();
  const [testPushState, setTestPushState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const { user } = useAuth();
  const { config, loading: configLoading } = useAppConfig();
  const [updatingPartyMode, setUpdatingPartyMode] = useState(false);
  const [updatingBar, setUpdatingBar] = useState(false);
  const [updatingTheme, setUpdatingTheme] = useState(false);
  const [barError, setBarError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const isTheAdmin = Boolean(user && config && user.uid === config.adminUid);

  // The door password lives in the staff-only private doc, never in the
  // publicly-readable config
  const [privateData] = useDocumentData(doc(db, 'config', 'private'));
  const barPassword = (privateData?.barPassword as string | null | undefined) ?? null;

  // QR encodes the menu URL with the password baked in — guests scan and
  // ordering just works
  useEffect(() => {
    // No sync setState here (lint); a stale QR is harmless — rendering is
    // gated on barOpen && barPassword
    if (!barPassword || !config?.barOpen) return;
    const url = `${window.location.origin}/?pw=${encodeURIComponent(barPassword)}`;
    QRCode.toDataURL(url, { width: 240, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [barPassword, config?.barOpen]);

  const activeQ = query(
    collection(db, 'orders'),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  const [snap, ordersLoading] = useCollection(activeQ);
  const orders = (snap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
  const { drinks } = useDrinks(true);
  const drinkById = new Map(drinks.map((d) => [d.id, d]));
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const recentFinished = orders
    .filter((o) => o.status === 'delivered' || o.status === 'cancelled')
    .slice(0, 5);

  const openBar = async () => {
    setUpdatingBar(true);
    setBarError(null);
    try {
      await setDoc(doc(db, 'config', 'private'), { barPassword: generateBarPassword() }, { merge: true });
      await updateDoc(doc(db, 'config', 'app'), {
        barOpen: true,
        barOpenedAt: serverTimestamp(),
      });
    } catch {
      setBarError('Failed to open the bar. Try again.');
    } finally {
      setUpdatingBar(false);
    }
  };

  const regeneratePassword = async () => {
    await setDoc(doc(db, 'config', 'private'), { barPassword: generateBarPassword() }, { merge: true });
  };

  const saveCustomPassword = async () => {
    const trimmed = passwordDraft.trim();
    // Must survive the server's normalization (letters/digits only)
    if (trimmed.replace(/[^a-zA-Z0-9]/g, '').length < 3) {
      setBarError('Passwords need at least 3 letters or numbers.');
      return;
    }
    await setDoc(doc(db, 'config', 'private'), { barPassword: trimmed }, { merge: true });
    setEditingPassword(false);
  };

  const closeBar = async () => {
    setUpdatingBar(true);
    setBarError(null);
    try {
      // Closing the bar burns the password and ends guest bartender shifts
      // (only the admin may write the staff lists, per rules)
      await setDoc(doc(db, 'config', 'private'), { barPassword: null }, { merge: true });
      await updateDoc(doc(db, 'config', 'app'), {
        barOpen: false,
        ...(isTheAdmin ? { bartenderUids: [], bartenderNames: {} } : {}),
      });
    } finally {
      setUpdatingBar(false);
    }
  };

  const sendTestPush = async () => {
    setTestPushState('sending');
    try {
      const fn = httpsCallable<Record<string, never>, { sentTo: number }>(functions, 'sendTestPush');
      await fn({});
      setTestPushState('sent');
      setTimeout(() => setTestPushState('idle'), 6000);
    } catch {
      setTestPushState('failed');
    }
  };

  const inviteBartender = async () => {
    setCreatingInvite(true);
    try {
      const fn = httpsCallable<Record<string, never>, { code: string; expiresAt: number }>(
        functions,
        'createBartenderInvite',
      );
      const result = await fn({});
      setInviteCode(result.data.code);
    } catch {
      setBarError('Could not create an invite. Try again.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const revokeBartender = async (uid: string) => {
    await updateDoc(doc(db, 'config', 'app'), {
      bartenderUids: arrayRemove(uid),
      [`bartenderNames.${uid}`]: deleteField(),
    });
  };


  const togglePartyMode = async () => {
    if (!config) return;
    setUpdatingPartyMode(true);
    await updateDoc(doc(db, 'config', 'app'), { partyMode: !config.partyMode });
    setUpdatingPartyMode(false);
  };

  const setTheme = async (theme: ThemeName | null) => {
    if (!theme) return;
    setUpdatingTheme(true);
    try {
      await updateDoc(doc(db, 'config', 'app'), { theme });
    } finally {
      setUpdatingTheme(false);
    }
  };

  const myStaffName = user
    ? (config?.bartenderNames?.[user.uid] ?? user.displayName ?? 'The host')
    : 'The host';

  const advance = async (orderId: string, currentStatus: OrderStatus, claimedBy?: string) => {
    const next = NEXT_STATUS[currentStatus];
    if (!next || !user) return;
    const updates: Record<string, unknown> = { status: next };
    // First touch claims the order so co-bartenders don't double-make drinks
    if (!claimedBy) {
      updates.claimedBy = user.uid;
      updates.claimedByName = myStaffName;
    }
    if (currentStatus === 'received') updates.viewedAt = serverTimestamp();
    if (next === 'making') updates.makingAt = serverTimestamp();
    if (next === 'ready') updates.readyAt = serverTimestamp();
    if (next === 'delivered') updates.deliveredAt = serverTimestamp();
    await updateDoc(doc(db, 'orders', orderId), updates);
  };

  return (
    <>
      <AdminNav />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Notification status + device management */}
        {supported === false && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Push notifications aren&apos;t configured (VAPID key missing or unsupported browser) — you won&apos;t get order pings.
          </Alert>
        )}
        <NotificationDevices />
        {supported && fcmToken && (
          <Alert
            severity={testPushState === 'failed' ? 'error' : 'success'}
            sx={{ mb: 3 }}
            action={
              <Button size="small" onClick={sendTestPush} disabled={testPushState === 'sending'} sx={{ whiteSpace: 'nowrap' }}>
                {testPushState === 'sending' ? 'Sending…' : 'Send test push'}
              </Button>
            }
          >
            {testPushState === 'sent'
              ? 'Test sent — a notification should appear on every device where you enabled them.'
              : testPushState === 'failed'
                ? 'Test push failed — check your connection and try again.'
                : 'Notifications are on for this device.'}
          </Alert>
        )}

        {/* Bar open/close */}
        {barError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setBarError(null)}>
            {barError}
          </Alert>
        )}
        <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <Typography variant="h6">
                The Bar
                {config?.barOpen && (
                  <Chip label="OPEN" size="small" color="success" sx={{ ml: 1, fontSize: '0.6rem' }} />
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {config?.barOpen
                  ? `Open${config.barOpenedAt ? ` since ${config.barOpenedAt.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''} — guests need the door password to order.`
                  : 'Opening the bar generates a door password guests use to order.'}
              </Typography>
            </Box>
            <Button
              variant={config?.barOpen ? 'outlined' : 'contained'}
              color={config?.barOpen ? 'error' : 'primary'}
              onClick={config?.barOpen ? closeBar : openBar}
              disabled={configLoading || updatingBar}
              sx={{ minWidth: 120 }}
            >
              {updatingBar ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : config?.barOpen ? 'Close Bar' : 'Open Bar'}
            </Button>
          </Box>
          {config?.barOpen && !barPassword && (
            <Alert
              severity="warning"
              sx={{ mt: 2 }}
              action={
                <Button size="small" onClick={regeneratePassword} sx={{ whiteSpace: 'nowrap' }}>
                  Generate password
                </Button>
              }
            >
              The bar is open with no door password — anyone can order. Generate one to lock the door.
            </Alert>
          )}
          {config?.barOpen && barPassword && (
            <Box sx={{ mt: 2, display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
              {qrDataUrl && (
                <Box
                  component="img"
                  src={qrDataUrl}
                  alt="Scan to unlock ordering"
                  sx={{ width: 132, height: 132, borderRadius: 1, border: '4px solid white' }}
                />
              )}
              <Box sx={{ minWidth: 180 }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.15em', fontSize: '0.6rem' }}>
                  Tonight&apos;s password 🤫
                </Typography>
                {editingPassword ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                    <TextField
                      size="small"
                      value={passwordDraft}
                      onChange={(e) => setPasswordDraft(e.target.value)}
                      placeholder="Your password"
                      slotProps={{ htmlInput: { maxLength: 40 } }}
                      sx={{ width: 200 }}
                    />
                    <Button size="small" variant="contained" onClick={saveCustomPassword}>
                      Save
                    </Button>
                    <Button size="small" onClick={() => setEditingPassword(false)} sx={{ color: 'text.secondary' }}>
                      Cancel
                    </Button>
                  </Box>
                ) : (
                  <Typography variant="h4" sx={{ color: 'primary.main', letterSpacing: '0.06em' }}>
                    {barPassword}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Guests scan the QR or type the password with their first order. Changing it kicks out anyone who has it.
                </Typography>
                {!editingPassword && (
                  <Box sx={{ mt: 0.5 }}>
                    <Button size="small" onClick={regeneratePassword} sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                      New password
                    </Button>
                    <Button
                      size="small"
                      onClick={() => { setPasswordDraft(barPassword ?? ''); setEditingPassword(true); }}
                      sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                    >
                      Set my own
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Party Mode toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
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

        {/* Theme picker */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Typography variant="h6">Theme</Typography>
            <Typography variant="caption" color="text.secondary">
              Applies instantly to every guest&apos;s phone.
            </Typography>
          </Box>
          {updatingTheme ? (
            <CircularProgress size={24} sx={{ color: 'primary.main' }} />
          ) : (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={config?.theme ?? 'speakeasy'}
              onChange={(_, value: ThemeName | null) => setTheme(value)}
              disabled={configLoading}
            >
              <ToggleButton value="speakeasy">🥃 Speakeasy</ToggleButton>
              <ToggleButton value="july4">🇺🇸 July 4th</ToggleButton>
              <ToggleButton value="w00w00">👀 w00w00</ToggleButton>
              <ToggleButton value="beach">⛵ Beach</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>

        {/* Staff — guest bartender invites (admin only) */}
        {isTheAdmin && (
          <Box sx={{ mb: 4, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="h6">Staff</Typography>
                <Typography variant="caption" color="text.secondary">
                  Guest bartenders get the queue, bar controls, and order pings. Their shift ends when you close the bar (or revoke them).
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={inviteBartender}
                disabled={creatingInvite}
                sx={{ borderColor: 'primary.dark', color: 'primary.main' }}
              >
                {creatingInvite ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : 'Invite a bartender'}
              </Button>
            </Box>
            {inviteCode && (
              <Alert severity="success" sx={{ mt: 2 }} onClose={() => setInviteCode(null)}>
                Invite code: <strong style={{ fontSize: '1.1rem', letterSpacing: '0.15em' }}>{inviteCode}</strong>
                {' — '}have them sign in with Google at <strong>{window.location.origin}/bartender</strong> and enter it. Expires in 24h, single use.
              </Alert>
            )}
            {(config?.bartenderUids ?? []).length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(config?.bartenderUids ?? []).map((uid) => (
                  <Chip
                    key={uid}
                    label={config?.bartenderNames?.[uid] ?? uid.slice(0, 8)}
                    onDelete={() => revokeBartender(uid)}
                    variant="outlined"
                    sx={{ borderColor: 'primary.dark' }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

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
                <OrderCard
                  order={order}
                  drink={drinkById.get(order.drinkId)}
                  myUid={user?.uid}
                  onAdvance={() => advance(order.id, order.status, order.claimedBy)}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {recentFinished.length > 0 && (
          <>
            <Divider sx={{ my: 4 }} />
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.15em', fontSize: '0.65rem' }}>
              Recently Finished
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recentFinished.map((order) => (
                <Box key={order.id} sx={{ display: 'flex', gap: 2, opacity: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={order.status === 'cancelled' ? { textDecoration: 'line-through' } : undefined}
                  >
                    {order.drinkName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    → {order.guestName}{order.status === 'cancelled' ? ' (cancelled)' : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Container>
    </>
  );
}

// Render-safe clock: time is external mutable state, so read it through
// useSyncExternalStore (Date.now() directly in render violates
// react-hooks/purity). Quantized to 30s buckets so the snapshot is stable
// between ticks — and the "Xm ago" labels stay honest as orders age.
const NOW_TICK_MS = 30_000;
function subscribeToClock(onTick: () => void) {
  const timer = setInterval(onTick, NOW_TICK_MS);
  return () => clearInterval(timer);
}
function useNow(): number {
  return useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / NOW_TICK_MS) * NOW_TICK_MS,
  );
}

function OrderCard({ order, drink, myUid, onAdvance }: { order: Order; drink?: Drink; myUid?: string; onAdvance: () => void }) {
  const [advancing, setAdvancing] = useState(false);
  const now = useNow();
  const next = NEXT_STATUS[order.status];

  const handleAdvance = async () => {
    setAdvancing(true);
    await onAdvance();
    setAdvancing(false);
  };

  const age = order.createdAt
    ? Math.max(0, Math.round((now - (order.createdAt as { toMillis(): number }).toMillis()) / 60000))
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
        {order.claimedBy && (
          <Chip
            label={order.claimedBy === myUid ? "You're on it" : `${order.claimedByName ?? 'Someone'} is on it`}
            size="small"
            color={order.claimedBy === myUid ? 'success' : 'info'}
            variant="outlined"
            sx={{ mt: 0.5, fontSize: '0.65rem' }}
          />
        )}
        {order.note && (
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'secondary.main', mt: 0.5 }}>
            “{order.note}”
          </Typography>
        )}
        {drink && drink.ingredients.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {drink.ingredients.join(' · ')}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
          {age !== null ? (age === 0 ? 'just now' : `${age}m ago`) : ''}
          {order.distanceM != null ? `${age !== null ? ' · ' : ''}ordered ${order.distanceM}m away` : ''}
        </Typography>
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
