import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CircularProgress from '@mui/material/CircularProgress';
import { useParams, useNavigate } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import type { Order, OrderStatus as OrderStatusType } from '../lib/schema';

const PARTY_STEPS: { status: OrderStatusType; label: string; desc: string }[] = [
  { status: 'received', label: 'Received', desc: "We've got your order." },
  { status: 'viewed', label: 'Seen', desc: 'The bartender has seen it.' },
  { status: 'making', label: 'Making', desc: "We're crafting your drink." },
  { status: 'ready', label: 'Ready!', desc: 'Come pick it up!' },
];

const SIMPLE_STEPS: { status: OrderStatusType; label: string; desc: string }[] = [
  { status: 'received', label: 'Received', desc: "We've got your order." },
  { status: 'viewed', label: 'Seen', desc: 'The bartender has seen it. Hang tight!' },
];

function getActiveStep(status: OrderStatusType, partyMode: boolean): number {
  const steps = partyMode ? PARTY_STEPS : SIMPLE_STEPS;
  const idx = steps.findIndex((s) => s.status === status);
  return idx === -1 ? steps.length - 1 : idx;
}

export default function OrderStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [orderData, loading] = useDocumentData(doc(db, 'orders', id ?? '_'));
  const order = orderData as Omit<Order, 'id'> | undefined;

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

  const steps = order.partyMode ? PARTY_STEPS : SIMPLE_STEPS;
  const activeStep = getActiveStep(order.status, order.partyMode);
  const currentStep = steps[activeStep];
  const isReady = order.status === 'ready';
  const isDelivered = order.status === 'delivered';

  return (
    <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {order.drinkName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
        for {order.guestName}
      </Typography>

      {isDelivered ? (
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

      <Button
        variant="text"
        onClick={() => navigate('/')}
        sx={{ mt: 5, color: 'text.secondary', fontSize: '0.75rem' }}
      >
        Back to menu
      </Button>
    </Container>
  );
}
