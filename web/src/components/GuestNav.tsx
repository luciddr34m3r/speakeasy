import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../hooks/useAppConfig';

export default function GuestNav() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useAppConfig();

  const isAdmin = user && config && user.uid === config.adminUid;

  return (
    <AppBar position="sticky" sx={{ bgcolor: '#0a0a0a', borderBottom: '1px solid rgba(201,169,110,0.15)' }} elevation={0}>
      <Toolbar variant="dense">
        <Typography
          variant="h6"
          sx={{ fontFamily: '"Cormorant", serif', color: 'primary.main', cursor: 'pointer', flexGrow: 1, fontSize: '1.3rem' }}
          onClick={() => navigate('/')}
        >
          The Speakeasy
        </Typography>
        <Box sx={{ display: 'flex' }}>
          {isAdmin && (
            <Tooltip title="Admin">
              <IconButton size="small" onClick={() => navigate('/admin')} sx={{ color: 'primary.main' }}>
                <AdminPanelSettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Get a recommendation">
            <IconButton size="small" onClick={() => navigate('/recommend')} sx={{ color: 'text.secondary' }}>
              <AutoAwesomeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={user && !user.isAnonymous ? 'Your orders' : 'Sign in'}>
            <IconButton size="small" onClick={() => navigate(user && !user.isAnonymous ? '/me' : '/signin')} sx={{ color: 'text.secondary' }}>
              <PersonIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
