import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PersonIcon from '@mui/icons-material/Person';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../hooks/useAppConfig';
import ShareBarDialog from './ShareBarDialog';

export default function GuestNav() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useAppConfig();
  const [shareOpen, setShareOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const isAdmin =
    user && config &&
    (user.uid === config.adminUid || (config.bartenderUids ?? []).includes(user.uid));

  const go = (path: string) => {
    setMenuAnchor(null);
    navigate(path);
  };

  const items = [
    ...(isAdmin
      ? [{ label: 'Admin', icon: <AdminPanelSettingsIcon fontSize="small" />, path: '/admin', accent: true }]
      : []),
    { label: 'For You', icon: <AutoAwesomeIcon fontSize="small" />, path: '/recommend', accent: false },
    { label: 'Orders', icon: <PersonIcon fontSize="small" />, path: '/me', accent: false },
  ];

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
          noWrap
          sx={(t) => ({ fontFamily: t.typography.h5.fontFamily, color: 'primary.main', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', flexGrow: 1, fontSize: '1.3rem' })}
          onClick={() => navigate('/')}
        >
          The Speakeasy
        </Typography>

        {/* The QR share button earns a permanent slot — it's the party workhorse */}
        {isAdmin && config?.barOpen && (
          <IconButton
            size="small"
            aria-label="Share the door password"
            onClick={() => setShareOpen(true)}
            sx={{ color: 'primary.main' }}
          >
            <QrCode2Icon fontSize="small" />
          </IconButton>
        )}

        {/* Wide screens: labeled buttons */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5, alignItems: 'center' }}>
          {items.map((item) => (
            <Button
              key={item.path}
              size="small"
              startIcon={item.icon}
              onClick={() => navigate(item.path)}
              sx={{ color: item.accent ? 'primary.main' : 'text.secondary', fontSize: '0.7rem' }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        {/* Phones: everything else lives behind the three dots */}
        <IconButton
          size="small"
          aria-label="More options"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'text.secondary' }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {items.map((item) => (
            <MenuItem key={item.path} onClick={() => go(item.path)}>
              <ListItemIcon sx={{ color: item.accent ? 'primary.main' : 'text.secondary' }}>{item.icon}</ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { color: item.accent ? 'primary.main' : 'text.primary' } } }}>
                {item.label}
              </ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
      <ShareBarDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </AppBar>
  );
}
