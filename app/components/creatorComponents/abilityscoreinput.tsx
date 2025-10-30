import React from "react";
import { TextField, Typography, InputAdornment } from "@mui/material";
import Box from '@mui/material/Box';
import { Grid } from "@mui/material";
import { useTheme } from '@mui/material/styles';
import { plusMinus } from "@/5eReference/converters";

interface AbilityScoreInputProps {
  name: string;
  label: string;
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  icon?: React.ReactNode;
  modifier: number;
}

const AbilityScoreInput: React.FC<AbilityScoreInputProps> = ({
  name,
  label,
  value,
  onChange,
  icon,
  modifier,
}) => {
  const theme = useTheme()
  return (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      height: '100%',
    }}
  >
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      fontSize: '2rem',
      padding: '4px'
    }}>
      {icon}
    </Box>
    <TextField
      name={name}
      label={label}
      variant="outlined"
      value={value}
      onChange={onChange}
      type="number"
      slotProps={{
        input: {
          style: {
            width: '13ch',
            textAlign: 'center',
            padding: '8px 4px'
          },
        }
      }}
      sx={{
        '& .MuiInputBase-root': {
          // width: '120px',
          height: '60px'
        }
      }}
    />
    <Box
      sx={{
        height: "100%", // Or any desired height for the container
        display: 'block',
        flexDirection: 'column', // Arrange children in a column
        justifyContent: 'center', // Vertically center the content
        alignItems: 'center', // Optionally, horizontally center as well
        backgroundColor: theme.palette.primary.light,
        border: '1px solid grey', // For visualization
        borderRadius: '4px',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          width: '3ch',
          textAlign: 'center',
          height: '100%',
          margin: "auto",
          lineHeight: "60px"
        }}
      >
        {plusMinus(modifier)}
      </Typography>
    </Box>
  </Box>
)};

export default AbilityScoreInput;
