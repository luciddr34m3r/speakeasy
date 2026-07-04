import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../hooks/useAppConfig';

export default function GuestNav() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useAppConfig();

  const isAdmin =
    user && config &&
    (user.uid === config.adminUid || (config.bartenderUids ?? []).includes(user.uid));

  return (
    <AppBar
      position="sticky"
      sx={(t) => ({
        bgcolor: t.custom.navBg,
        borderBottom: `1px solid ${alpha(t.palette.primary.main, 0.15)}`,
      })}
      elevation={0}
    >
      <Toolbar variant="dense">
        <Typography
          variant="h6"
          sx={{ fontFamily: '"Cormorant", serif', color: 'primary.main', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', flexGrow: 1, fontSize: '1.3rem' }}
          onClick={() => navigate('/')}
        >
          The Speakeasy
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isAdmin && (
            <Button
              size="small"
              startIcon={<AdminPanelSettingsIcon fontSize="small" />}
              onClick={() => navigate('/admin')}
              sx={{ color: 'primary.main', fontSize: '0.7rem' }}
            >
              Admin
            </Button>
          )}
          <Button
            size="small"
            startIcon={<AutoAwesomeIcon fontSize="small" />}
            onClick={() => navigate('/recommend')}
            sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
          >
            For You
          </Button>
          <Button
            size="small"
            startIcon={<PersonIcon fontSize="small" />}
            onClick={() => navigate('/me')}
            sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
          >
            Orders
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
