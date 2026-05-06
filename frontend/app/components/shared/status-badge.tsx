import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type StatusBadgeProps = {
  status: string;
  size?: 'small' | 'medium';
};

export function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const key = status.toLowerCase();
  
  let color = '#94a3b8'; // default slate
  let bgColor = '#f1f5f9';

  if (key === 'online' || key === 'up' || key === 'ok') {
    color = '#22c55e'; // success green
    bgColor = '#f0fdf4';
  } else if (key === 'offline' || key === 'down' || key === 'bad') {
    color = '#ef4444'; // error red
    bgColor = '#fef2f2';
  } else if (key === 'degraded' || key === 'medium') {
    color = '#f59e0b'; // warning amber
    bgColor = '#fffbeb';
  }

  const px = size === 'small' ? 1.5 : 2;
  const py = size === 'small' ? 0.25 : 0.5;
  const fontSize = size === 'small' ? 11 : 13;
  const dotSize = size === 'small' ? 6 : 8;

  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1,
      bgcolor: bgColor,
      color: color,
      px: px,
      py: py,
      borderRadius: 10,
      border: `1px solid ${color}20`,
    }}>
      <Box sx={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        bgcolor: color,
        boxShadow: `0 0 6px ${color}60`
      }} />
      <Typography sx={{
        fontSize: fontSize,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        lineHeight: 1.5
      }}>
        {status}
      </Typography>
    </Box>
  );
}
