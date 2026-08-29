import './env'; // Must be first: provides process.env shim for Vite while keeping CRA compatibility.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import './styles/global.css';

// Global Material theme (dark / black)
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo-500
      light: '#8b90ff',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#8b5cf6', // Violet-500
      light: '#a78bfa',
      dark: '#7c3aed',
    },
    background: {
      default: '#0b0f14', // near-black
      paper: '#0f1520',   // dark surface
    },
    text: {
      primary: '#e6e8f0',
      secondary: '#94a3b8',
    },
    divider: 'rgba(148,163,184,0.16)'
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    body1: {
      lineHeight: 1.6,
    },
    body2: {
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '10px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          border: '1px solid rgba(99, 102, 241, 0.12)'
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
          '& .MuiInputBase-input': {
            // Force dark text visibility on white/light backgrounds (common in Wizard/Panels)
            // but keep it white on dark backgrounds (default theme mode is dark)
            // We use a conditional check via theme or explicit CSS if needed.
            // However, the best global fix for "white on white" is to ensure 
            // the input color is always legible regardless of the background.
            // Since mode is 'dark', text.primary is '#e6e8f0' (off-white).
            // If the background is forced to white in a component, this off-white becomes invisible.
          },
        },
      },
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          // This is the core fix: if the background-color of the parent or self is white,
          // the text must be dark. We use a CSS variable or inherit color properly.
          // For now, we'll ensure that inputs inside light-themed containers are corrected.
          '&.MuiInputBase-root': {
            // When inside a white background (like Onboarding Wizard or Analysis Panel), 
            // the text color should be dark. We target common light background containers.
            '.light-theme-container &': {
              color: '#111827 !important',
              '& .MuiInputBase-input': {
                color: '#111827 !important',
                WebkitTextFillColor: '#111827 !important',
              },
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '.light-theme-container &': {
            color: '#111827 !important',
            '& .MuiSelect-select': {
              color: '#111827 !important',
              WebkitTextFillColor: '#111827 !important',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        }
      }
    }
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
); 