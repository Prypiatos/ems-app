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
    <Card elevation={0} sx={{ 
      height: '100%', 
      borderRadius: 4, 
      border: '1px solid rgba(0, 0, 0, 0.06)',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      }
    }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.1, display: 'block', mb: 1 }}>
          {label}
        </Typography>
        <Typography variant="h4" component="div" sx={{ fontWeight: 800, color: colorMap[status], letterSpacing: -0.5 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

