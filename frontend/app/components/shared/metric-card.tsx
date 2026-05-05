'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

type MetricCardProps = {
  label: string;
  value: string;
  sub?: string;
  status?: 'ok' | 'bad' | 'neutral';
};

export function MetricCard({ label, value, sub, status = 'neutral' }: MetricCardProps) {
  const colorMap = {
    ok: 'success.main',
    bad: 'error.main',
    neutral: 'text.primary',
  };

  return (
    <Card elevation={1} className="h-full rounded-xl border border-gray-100">
      <CardContent className="p-4">
        <Typography variant="overline" color="text.secondary" className="font-bold tracking-wider mb-1 block leading-none">
          {label}
        </Typography>
        <Typography variant="h5" component="div" className="font-bold mb-1" sx={{ color: colorMap[status] }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" className="block mt-1">
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

