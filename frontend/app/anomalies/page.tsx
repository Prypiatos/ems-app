'use client';
import Link from 'next/link';
import { Button, Box, Typography, AppBar, Toolbar } from '@mui/material';
import Anomalies from '../components/anomalies';

export default function Page() {
  return (
    <Box className="min-h-screen bg-slate-50 flex flex-col">
      <AppBar position="sticky" color="inherit" elevation={1} className="border-b border-gray-200">
        <Toolbar className="px-4">
          <Link href="/">
            <Button variant="text" className="font-bold mr-4">← Back to Dashboard</Button>
          </Link>
          <Typography variant="h6" className="font-bold flex-1">Anomalies</Typography>
          <Link href="/stream-summary">
            <Button size="small" variant="text" className="font-bold">📈 Stream</Button>
          </Link>
          <Link href="/recommendations">
            <Button size="small" variant="text" className="font-bold">💡 Recommend</Button>
          </Link>
        </Toolbar>
      </AppBar>
      <main style={{ padding: 20, flex: 1 }}>
        <div style={{ maxWidth: 1200 }}>
          <Anomalies />
        </div>
      </main>
    </Box>
  );
}
