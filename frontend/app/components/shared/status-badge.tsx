'use client';

import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import HelpIcon from '@mui/icons-material/Help';

type StatusBadgeProps = {
  status: string;
  size?: 'small' | 'medium';
};

export function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const key = status.toLowerCase();
  
  let color: 'success' | 'error' | 'warning' | 'default' = 'default';
  let icon = <HelpIcon />;

  if (key === 'online' || key === 'up' || key === 'ok') {
    color = 'success';
    icon = <CheckCircleIcon />;
  } else if (key === 'offline' || key === 'down' || key === 'bad') {
    color = 'error';
    icon = <ErrorIcon />;
  } else if (key === 'degraded' || key === 'medium') {
    color = 'warning';
    icon = <WarningIcon />;
  }

  return (
    <Chip
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      color={color}
      size={size}
      icon={icon}
      variant="outlined"
      className="font-bold capitalize bg-white"
    />
  );
}
