import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main:  '#818cf8',  // indigo-400 — links, back buttons, chips
      light: '#c7d2fe',  // indigo-200 — hover states
      dark:  '#6366f1',  // indigo-500 — button fills, section headings
    },
    secondary: {
      main: '#22d3ee',   // cyan — hardware accent
    },
    background: {
      default: '#0f1117',
      paper:   '#1a1d27',
    },
    text: {
      primary:   '#f1f5f9',  // slate-100
      secondary: '#94a3b8',  // slate-400
      disabled:  '#475569',  // slate-600
    },
    divider: 'rgba(255,255,255,0.08)',
    error: {
      main: '#f87171',   // red-400
    },
    success: {
      main: '#4ade80',   // green-400
    },
    warning: {
      main: '#fbbf24',   // amber-400
    },
    info: {
      main: '#38bdf8',   // sky-400
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.08)',
        },
      },
    },
  },
});

export default theme;
