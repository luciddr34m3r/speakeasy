import { createTheme } from '@mui/material/styles';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/700.css';

// Color tokens from the w00w00 deck system (generate_decks.py):
// INK #0a0a0b · BONE #f5f2ed · GRAY600 #6e6e73 · GRAY200 #d2d2d7
// INK100 #1c1c1e · INK200 #2a2a2d · TLP:RED #ff0033 · TLP:AMBER #ffc000
const INK = '#0a0a0b';
const INK100 = '#1c1c1e';
const INK200 = '#2a2a2d';
const BONE = '#f5f2ed';
const GRAY600 = '#6e6e73';
const GRAY200 = '#d2d2d7';
const TLP_RED = '#ff0033';
const TLP_AMBER = '#ffc000';

const MONO = '"IBM Plex Mono", monospace';

const w00w00 = createTheme({
  custom: {
    name: 'w00w00',
    metaThemeColor: INK,
    navBg: INK,
    placeholderGradient: `linear-gradient(135deg, ${INK100} 0%, ${INK200} 100%)`,
    placeholderEmoji: '👀',
    decorations: true,
  },
  palette: {
    mode: 'dark',
    background: {
      default: INK,
      paper: INK100,
    },
    primary: {
      main: BONE,
      light: '#ffffff',
      dark: GRAY200,
      contrastText: INK,
    },
    secondary: {
      main: TLP_RED,
    },
    error: {
      main: TLP_RED,
    },
    warning: {
      main: TLP_AMBER,
    },
    divider: INK200,
    text: {
      primary: BONE,
      secondary: GRAY600,
    },
  },
  shape: {
    // Registration-mark aesthetic: hard corners
    borderRadius: 2,
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    h1: { fontFamily: MONO, fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: MONO, fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: MONO, fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontFamily: MONO, fontWeight: 700 },
    h5: { fontFamily: MONO, fontWeight: 500 },
    h6: { fontFamily: MONO, fontWeight: 500 },
    button: { fontFamily: MONO, fontWeight: 500, textTransform: 'none' },
    overline: { fontFamily: MONO },
    caption: { fontFamily: MONO },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'none',
          scrollbarColor: `${INK200} ${INK}`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: INK },
          '&::-webkit-scrollbar-thumb': { background: INK200, borderRadius: 0 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: INK100,
          border: `1px solid ${INK200}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: MONO,
          borderRadius: 2,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontFamily: MONO,
          fontSize: '0.8rem',
        },
      },
    },
  },
});

export default w00w00;
