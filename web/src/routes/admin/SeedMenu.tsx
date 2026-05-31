import { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { functions } from '../../lib/firebase';
import AdminGuard from '../../components/AdminGuard';
import AdminNav from '../../components/AdminNav';

export default function SeedMenu() {
  return (
    <AdminGuard>
      <SeedMenuContent />
    </AdminGuard>
  );
}

function SeedMenuContent() {
  const navigate = useNavigate();
  const [namesRaw, setNamesRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSeed = async () => {
    const drinks = namesRaw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    if (drinks.length === 0) { setError('Enter at least one drink name.'); return; }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const fn = httpsCallable<{ drinks: { name: string }[] }, { created: number }>(
        functions,
        'seedMenu',
      );
      const result = await fn({ drinks });
      setSuccess(`${result.data.created} drinks added to the menu!`);
      setNamesRaw('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Seeding failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AdminNav />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <IconButton onClick={() => navigate('/admin/menu')} sx={{ color: 'primary.main' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">Seed Menu with AI</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter drink names below (one per line). Claude will generate ingredients and descriptions for each one and add them to the menu.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <TextField
          fullWidth
          multiline
          minRows={6}
          value={namesRaw}
          onChange={(e) => setNamesRaw(e.target.value)}
          placeholder="Old Fashioned&#10;Negroni&#10;Whiskey Sour&#10;Espresso Martini&#10;French 75"
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          onClick={handleSeed}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <AutoAwesomeIcon />}
        >
          {loading ? 'Generating…' : 'Generate & Add to Menu'}
        </Button>
      </Container>
    </>
  );
}
