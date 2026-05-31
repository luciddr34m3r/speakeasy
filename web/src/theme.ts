import { createTheme } from '@mui/material/styles';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/cormorant/400.css';
import '@fontsource/cormorant/400-italic.css';
import '@fontsource/cormorant/600.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0a0a',
      paper: '#141414',
    },
    primary: {
      main: '#c9a96e',
      light: '#dfc08e',
      dark: '#a0804a',
    },
    secondary: {
      main: '#e8e0d0',
    },
    divider: 'rgba(201,169,110,0.2)',
    text: {
      primary: '#f0ebe0',
      secondary: '#a09880',
    },
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    h1: { fontFamily: '"Cormorant", serif', fontWeight: 400, letterSpacing: '0.02em' },
    h2: { fontFamily: '"Cormorant", serif', fontWeight: 400, letterSpacing: '0.02em' },
    h3: { fontFamily: '"Cormorant", serif', fontWeight: 400, letterSpacing: '0.02em' },
    h4: { fontFamily: '"Cormorant", serif', fontWeight: 600 },
    h5: { fontFamily: '"Cormorant", serif', fontWeight: 600 },
    h6: { fontFamily: '"Cormorant", serif', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'none',
          scrollbarColor: '#c9a96e #141414',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: '#141414' },
          '&::-webkit-scrollbar-thumb': { background: '#c9a96e', borderRadius: 3 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(201,169,110,0.15)',
          backgroundImage: 'none',
          '&:hover': { border: '1px solid rgba(201,169,110,0.4)' },
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
            background: 'linear-gradient(135deg, #c9a96e, #a0804a)',
            '&:hover': { background: 'linear-gradient(135deg, #dfc08e, #c9a96e)' },
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
        root: { borderColor: 'rgba(201,169,110,0.2)' },
      },
    },
  },
});

export default theme;
