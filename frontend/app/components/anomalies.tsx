"use client"
import React, { useEffect, useState } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, CircularProgress } from '@mui/material';
import { pyFetch } from '../../lib/pythonClient';

type AnomalyRow = {
  node_id: string;
  timestamp: number;
  anomaly_type: string;
  score: number;
  severity?: string;
};

export default function Anomalies() {
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    pyFetch('/anomalies')
      .then(async res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        if (mounted) setRows(data as AnomalyRow[]);
      })
      .catch(err => { if (mounted) setError(String(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div>
      <Typography variant="h5" gutterBottom>Anomalies</Typography>
      {loading && <CircularProgress />}
      {error && <Typography color="error">{error}</Typography>}
      {!loading && !error && rows.length === 0 && (
        <Typography>No anomalies found</Typography>
      )}
      {!loading && !error && rows.length > 0 && (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Node</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Severity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(r.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{r.node_id}</TableCell>
                  <TableCell>{r.anomaly_type}</TableCell>
                  <TableCell>{Number(r.score).toFixed(4)}</TableCell>
                  <TableCell>{r.severity ?? 'n/a'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
