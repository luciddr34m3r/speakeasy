import { createTheme } from '@mui/material/styles';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/rye/400.css';

// Old Glory, dialed to 11. 🇺🇸
const RED = '#B22234';
const NAVY = '#3C3B6E';
const WHITE = '#f5f5f5';
const GOLD = '#FFD700';

const FLAG_STRIPES = `repeating-linear-gradient(90deg, ${RED} 0 16px, ${WHITE} 16px 32px, ${NAVY} 32px 48px)`;

const july4 = createTheme({
  custom: {
    name: 'july4',
    metaThemeColor: '#0A1B3D',
    navBg: '#081530',
    placeholderGradient: `linear-gradient(135deg, #0A1B3D 0%, ${RED} 100%)`,
    placeholderEmoji: '🎆',
    decorations: true,
  },
  palette: {
    mode: 'dark',
    background: {
      default: '#0A1B3D',
      paper: '#122A54',
    },
    primary: {
      main: RED,
      light: '#d84a5b',
      dark: '#8c1a28',
    },
    secondary: {
      main: GOLD,
    },
    error: {
      main: '#ff6d00',
    },
    divider: 'rgba(255,255,255,0.3)',
    text: {
      primary: '#ffffff',
      secondary: '#9FB3D9',
    },
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    h1: { fontFamily: '"Rye", serif', fontWeight: 400, letterSpacing: '0.03em' },
    h2: { fontFamily: '"Rye", serif', fontWeight: 400, letterSpacing: '0.03em' },
    h3: { fontFamily: '"Rye", serif', fontWeight: 400, letterSpacing: '0.03em' },
    h4: { fontFamily: '"Rye", serif', fontWeight: 400 },
    h5: { fontFamily: '"Rye", serif', fontWeight: 400 },
    h6: { fontFamily: '"Rye", serif', fontWeight: 400 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'none',
          scrollbarColor: `${GOLD} #122A54`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': {
            background: `repeating-linear-gradient(180deg, ${RED} 0 12px, ${WHITE} 12px 24px, ${NAVY} 24px 36px)`,
          },
          '&::-webkit-scrollbar-thumb': { background: GOLD, borderRadius: 3 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255,215,0,0.35)',
          backgroundImage: 'none',
          '&:hover': { border: `1px solid ${GOLD}` },
          transition: 'border-color 0.2s ease',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          textTransform: 'none',
          letterSpacing: '0.08em',
          ...(ownerState.variant === 'contained' && ownerState.color === 'primary' && {
            background: `linear-gradient(90deg, ${RED} 0%, ${RED} 34%, ${WHITE} 50%, ${NAVY} 66%, ${NAVY} 100%)`,
            color: '#0A1B3D',
            fontWeight: 700,
            textShadow: '0 1px 0 rgba(255,255,255,0.6)',
            border: `1px solid ${GOLD}`,
            '&:hover': {
              background: `linear-gradient(90deg, ${RED} 0%, ${RED} 34%, ${WHITE} 50%, ${NAVY} 66%, ${NAVY} 100%)`,
              filter: 'brightness(1.15)',
            },
          }),
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          height: 3,
          border: 0,
          background: FLAG_STRIPES,
        },
      },
    },
  },
});

export default july4;
