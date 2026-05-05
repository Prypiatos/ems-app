'use client';

import { useState, useEffect } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

type ToastProps = {
  message: string;
  onDone: () => void;
  duration?: number;
};

export function Toast({ message, onDone, duration = 2000 }: ToastProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [message]);

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
    setTimeout(onDone, 300); // Wait for transition
  };

  return (
    <Snackbar open={open} autoHideDuration={duration} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Alert onClose={handleClose} severity="info" variant="filled" sx={{ width: '100%', fontWeight: 600 }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
