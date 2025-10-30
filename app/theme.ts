// src/theme.ts

import { createTheme, ThemeOptions } from '@mui/material/styles';

// Your theme options
export const themeOptions: ThemeOptions = {
  palette: {
    // NOTE: 'type' is deprecated in MUI v5 and later.
    // If you are using MUI v5+, you might omit it or use mode: 'light'.
    mode: 'light', // Use 'mode' instead of 'type' for MUI v5+
    primary: {
      main: '#887569',
      light: 'rgba(190, 178, 170, 1)',
      dark: 'rgb(95, 81, 73)'
    },
    secondary: {
      main: '#E1E8E0',
    },
    background: {
      default: '#F1EEE7',
      paper: '#d5b59c',
    },
  },
  // Add other options like typography, components, etc., here
};

// Create the theme instance
const theme = createTheme(themeOptions);

export default theme;