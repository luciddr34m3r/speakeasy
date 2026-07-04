import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import MenuIcon from '@mui/icons-material/Menu';
import { alpha } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';

const LINKS = [
  { label: 'Orders', path: '/admin' },
  { label: 'Menu', path: '/admin/menu' },
  { label: 'Seed Menu', path: '/admin/seed' },
];

export default function AdminNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const go = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  return (
    <AppBar
      position="sticky"
      sx={(t) => ({
        bgcolor: t.custom.navBg,
        borderBottom: `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
      })}
      elevation={0}
    >
      <Toolbar>
        {/* Mobile: hamburger */}
        <IconButton
          aria-label="Open admin menu"
          onClick={() => setDrawerOpen(true)}
          sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'primary.main', mr: 1 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="h6"
          sx={{ fontFamily: '"Cormorant", serif', color: 'primary.main', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', mr: 3, flexGrow: { xs: 1, sm: 0 } }}
          onClick={() => navigate('/')}
        >
          Speakeasy
        </Typography>

        {/* Desktop: inline links */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexGrow: 1 }}>
          {LINKS.map((link) => (
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
        <Button
          size="small"
          onClick={() => navigate('/')}
          sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'text.disabled', fontSize: '0.7rem' }}
        >
          ← Bar menu
        </Button>
      </Toolbar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 230, pt: 1 }} role="navigation">
          <Typography variant="h6" sx={{ fontFamily: '"Cormorant", serif', color: 'primary.main', px: 2, py: 1 }}>
            Speakeasy
          </Typography>
          <Divider />
          <List>
            {LINKS.map((link) => (
              <ListItemButton key={link.path} selected={pathname === link.path} onClick={() => go(link.path)}>
                <ListItemText
                  primary={link.label}
                  slotProps={{ primary: { sx: { color: pathname === link.path ? 'primary.main' : 'text.primary' } } }}
                />
              </ListItemButton>
            ))}
            <Divider sx={{ my: 1 }} />
            <ListItemButton onClick={() => go('/')}>
              <ListItemText primary="← Bar menu" slotProps={{ primary: { sx: { color: 'text.secondary' } } }} />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}
