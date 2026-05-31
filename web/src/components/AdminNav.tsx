import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AdminNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const links = [
    { label: 'Orders', path: '/admin' },
    { label: 'Menu', path: '/admin/menu' },
    { label: 'AI Seed', path: '/admin/seed' },
  ];

  return (
    <AppBar position="sticky" sx={{ bgcolor: '#0d0d0d', borderBottom: '1px solid rgba(201,169,110,0.2)' }} elevation={0}>
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ fontFamily: '"Cormorant", serif', color: 'primary.main', cursor: 'pointer', mr: 3 }}
          onClick={() => navigate('/')}
        >
          Speakeasy
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
          {links.map((link) => (
            <Button
              key={link.path}
              size="small"
              onClick={() => navigate(link.path)}
              sx={{
                color: pathname === link.path ? 'primary.main' : 'text.secondary',
                borderBottom: pathname === link.path ? '2px solid' : '2px solid transparent',
                borderColor: pathname === link.path ? 'primary.main' : 'transparent',
                borderRadius: 0,
                pb: 0.5,
              }}
            >
              {link.label}
            </Button>
          ))}
        </Box>
        <Button size="small" onClick={() => navigate('/')} sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
          ← Bar menu
        </Button>
      </Toolbar>
    </AppBar>
  );
}
