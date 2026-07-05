import { createTheme } from '@mui/material/styles';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/cormorant/400.css';
import '@fontsource/cormorant/400-italic.css';
import '@fontsource/cormorant/600.css';

// New England harbor at dusk: deep navy water, sandy linen text, seafoam
// glass, polished brass. Elegant nautical — yacht club, not tiki bar.
const HARBOR = '#0b1c2c';
const HULL = '#12293d';
const SAND = '#f0e9da';
const DRIFTWOOD = '#9aa8ab';
const SEAFOAM = '#8fd3c7';
const BRASS = '#c8a45c';
const BUOY_RED = '#e2574c';

const beach = createTheme({
  custom: {
    name: 'beach',
    metaThemeColor: HARBOR,
    navBg: '#0d2133',
    placeholderGradient: `linear-gradient(160deg, ${HULL} 0%, #1a3a52 60%, #24506e 100%)`,
    placeholderEmoji: '🐚',
    decorations: true,
  },
  palette: {
    mode: 'dark',
    background: {
      default: HARBOR,
      paper: HULL,
    },
    primary: {
      main: SEAFOAM,
      light: '#b5e6dd',
      dark: '#5fa89c',
      contrastText: '#07211c',
    },
    secondary: {
      main: BRASS,
    },
    error: {
      main: BUOY_RED,
    },
    divider: 'rgba(143,211,199,0.22)',
    text: {
      primary: SAND,
      secondary: DRIFTWOOD,
    },
  },
  shape: {
    // Soft corners, like sea glass
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    h1: { fontFamily: '"Cormorant", serif', fontWeight: 400, letterSpacing: '0.04em' },
    h2: { fontFamily: '"Cormorant", serif', fontWeight: 400, letterSpacing: '0.04em' },
    h3: { fontFamily: '"Cormorant", serif', fontWeight: 400, letterSpacing: '0.04em' },
    h4: { fontFamily: '"Cormorant", serif', fontWeight: 600 },
    h5: { fontFamily: '"Cormorant", serif', fontWeight: 600 },
    h6: { fontFamily: '"Cormorant", serif', fontWeight: 600 },
    overline: { letterSpacing: '0.25em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: `linear-gradient(180deg, ${HARBOR} 0%, #0e2436 100%)`,
          backgroundAttachment: 'fixed',
          scrollbarColor: `${SEAFOAM} ${HULL}`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: HULL },
          '&::-webkit-scrollbar-thumb': { background: SEAFOAM, borderRadius: 3 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: HULL,
          border: '1px solid rgba(143,211,199,0.16)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          letterSpacing: '0.04em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
  },
});

export default beach;
