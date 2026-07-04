import { useState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import NotificationPrompt from '../components/NotificationPrompt';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Order, OrderStatus as OrderStatusType } from '../lib/schema';

const STEPS: { status: OrderStatusType; label: string; desc: string }[] = [
  { status: 'received', label: 'Received', desc: "We've got your order." },
  { status: 'viewed', label: 'Seen', desc: 'The bartender has seen it.' },
  { status: 'making', label: 'Making', desc: "We're crafting your drink." },
  { status: 'ready', label: 'Ready!', desc: 'Come pick it up!' },
];

function getActiveStep(status: OrderStatusType): number {
  const idx = STEPS.findIndex((s) => s.status === status);
  return idx === -1 ? STEPS.length - 1 : idx;
}

export default function OrderStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [orderData, loading] = useDocumentData(doc(db, 'orders', id ?? '_'));
  const order = orderData as Omit<Order, 'id'> | undefined;

  const handleCancel = async () => {
    if (!id) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await updateDoc(doc(db, 'orders', id), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      });
    } catch {
      // Rules reject the cancel once the order has left 'received'
      setCancelError('Too late — the bartender is already on it.');
    } finally {
      setCancelling(false);
      setConfirmCancelOpen(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Typography color="text.secondary">Order not found.</Typography>
      </Container>
    );
  }

  const steps = STEPS;
  const activeStep = getActiveStep(order.status);
  const currentStep = steps[activeStep];
  const isReady = order.status === 'ready';
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  return (
    <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {order.drinkName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
        for {order.guestName}
      </Typography>

      {isCancelled ? (
        <Box>
          <Typography variant="h2" sx={{ mb: 2 }}>🚫</Typography>
          <Typography variant="h5" sx={{ mb: 1 }}>Order cancelled</Typography>
          <Typography color="text.secondary">No worries — the menu awaits.</Typography>
        </Box>
      ) : isDelivered ? (
        <Box>
          <Typography variant="h2" sx={{ mb: 2 }}>🥂</Typography>
          <Typography variant="h5" sx={{ mb: 1 }}>Enjoy!</Typography>
          <Typography color="text.secondary">Cheers. Come back soon.</Typography>
        </Box>
      ) : (
        <>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 5 }}>
            {steps.map((step) => (
              <Step key={step.status}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': { color: 'text.secondary', fontSize: '0.75rem' },
                    '& .MuiStepLabel-label.Mui-active': { color: 'primary.main' },
                    '& .MuiStepLabel-label.Mui-completed': { color: 'text.secondary' },
                    '& .MuiStepIcon-root.Mui-active': { color: 'primary.main' },
                    '& .MuiStepIcon-root.Mui-completed': { color: 'primary.dark' },
                  }}
                >
                  {step.label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {isReady ? (
            <Box>
              <Typography variant="h2" sx={{ mb: 2 }}>🍹</Typography>
              <Typography variant="h5" color="primary.main" sx={{ mb: 1 }}>
                Your drink is ready!
              </Typography>
              <Typography color="text.secondary">Come grab it from the bar.</Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {currentStep?.desc}
              </Typography>
              <CircularProgress size={20} sx={{ color: 'primary.main', opacity: 0.5, mt: 1 }} />
            </Box>
          )}
        </>
      )}

      {order.partyMode && !isDelivered && !isCancelled && !isReady && <NotificationPrompt />}

      {cancelError && (
        <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }} onClose={() => setCancelError(null)}>
          {cancelError}
        </Alert>
      )}

      <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
        {order.status === 'received' && (
          <Button
            variant="text"
            onClick={() => setConfirmCancelOpen(true)}
            disabled={cancelling}
            sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
          >
            {cancelling ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : 'Cancel order'}
          </Button>
        )}
        <Button
          variant="text"
          onClick={() => navigate('/')}
          sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
        >
          Back to menu
        </Button>
      </Box>

      <ConfirmDialog
        open={confirmCancelOpen}
        title="Cancel this order?"
        message={`The ${order.drinkName} won't be made.`}
        confirmLabel="Cancel order"
        busy={cancelling}
        onConfirm={handleCancel}
        onClose={() => setConfirmCancelOpen(false)}
      />
    </Container>
  );
}
