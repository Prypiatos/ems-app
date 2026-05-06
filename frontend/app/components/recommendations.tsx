"use client"
import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemText, Chip, Typography, CircularProgress } from '@mui/material';
import { pyFetch } from '../../lib/pythonClient';

type Recommendation = {
  node_id: string;
  type: string;
  severity?: string;
  message: string;
  generated_at?: string;
  metadata?: Record<string, any>;
};

export default function Recommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    pyFetch('/recommendations')
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        if (mounted) setItems(data as Recommendation[]);
      })
      .catch((err) => { if (mounted) setError(String(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div>
      <Typography variant="h5" gutterBottom>Recommendations</Typography>
      {loading && <CircularProgress />}
      {error && <Typography color="error">{error}</Typography>}
      {!loading && !error && items.length === 0 && (
        <Typography>No recommendations</Typography>
      )}
      {!loading && !error && items.length > 0 && (
        <List>
          {items.map((r, i) => (
            <ListItem key={i} alignItems="flex-start" divider>
              <ListItemText
                primary={r.message}
                secondary={`${r.node_id} • ${r.generated_at ?? ''}`}
              />
              <Chip label={r.severity ?? 'unknown'} color={r.severity === 'high' ? 'error' : r.severity === 'medium' ? 'warning' : 'default'} />
            </ListItem>
          ))}
        </List>
      )}
    </div>
  );
}
