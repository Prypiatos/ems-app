 'use client';

import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { useAuth } from '../auth-provider';
import { StatusBadge } from '../shared/status-badge';

type ServiceStatus = {
  name: string;
  url: string;
  status: 'up' | 'down' | 'checking';
  latency?: number;
};

import { apiFetch, gatewayBase } from '../../../lib/apiGateway';

export function AdminTab() {
  const { username, roles, token, logout } = useAuth();
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Backend API', url: `/health`, status: 'checking' },
    { name: 'Kong Gateway', url: `/kong`, status: 'checking' },
    { name: 'Keycloak', url: `/keycloak`, status: 'checking' },
  ]);

  const checkServices = useCallback(async () => {
    // Use the configured API gateway (Kong) as the single entrypoint
    const baseKong = gatewayBase();
    const baseBackend = baseKong; // route backend checks through the gateway
    const keycloakBase = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8180`
      : `http://localhost:8180`;

    const checks: ServiceStatus[] = [];

    // Backend
    try {
      const t0 = performance.now();
      const res = await apiFetch(`/api/v1/health`, { signal: AbortSignal.timeout(5000) });
      checks.push({ name: 'Backend API', url: `${baseBackend}/api/v1/health`, status: res.ok ? 'up' : 'down', latency: Math.round(performance.now() - t0) });
    } catch {
      checks.push({ name: 'Backend API', url: `${baseBackend}/api/v1/health`, status: 'down' });
    }

    // Kong
    try {
      const t0 = performance.now();
      const res = await apiFetch(`/api/v1/health`, {
        signal: AbortSignal.timeout(5000),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      checks.push({ name: 'Kong Gateway', url: `${baseKong}`, status: res.ok ? 'up' : 'down', latency: Math.round(performance.now() - t0) });
    } catch {
      checks.push({ name: 'Kong Gateway', url: `${baseKong}`, status: 'down' });
    }

    // Keycloak (route through gateway under /keycloak if configured)
    try {
      const t0 = performance.now();
      const res = await apiFetch(`/keycloak/realms/ems`, { signal: AbortSignal.timeout(5000) });
      checks.push({ name: 'Keycloak', url: `${gatewayBase()}/keycloak`, status: res.ok ? 'up' : 'down', latency: Math.round(performance.now() - t0) });
    } catch {
      checks.push({ name: 'Keycloak', url: `${gatewayBase()}/keycloak`, status: 'down' });
    }

    setServices(checks);
  }, [token]);

  useEffect(() => {
    checkServices();
    const t = setInterval(checkServices, 15000);
    return () => clearInterval(t);
  }, [checkServices]);

  const grafanaUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
  const prometheusUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:9090` : 'http://localhost:9090';
  const keycloakAdminUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8180/admin` : 'http://localhost:8180/admin';

  return (
    <Box className="pb-8">
      <Box className="flex justify-between items-center mb-6">
        <Typography variant="h4" component="h1" className="font-bold">
          Admin Panel
        </Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={checkServices}>
          Refresh Status
        </Button>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12 }}>
          <Card elevation={0} className="border border-gray-200">
            <CardContent>
              <Typography variant="h6" className="font-bold mb-4">
                Service Health
              </Typography>
              <Grid container spacing={2}>
                {services.map((svc) => (
                  <Grid key={svc.name} size={{ xs: 12, md: 4 }}>
                    <Box className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                      <Box className="flex justify-between items-center mb-3">
                        <Typography color="text.primary" className="font-bold">
                          {svc.name}
                        </Typography>
                        <StatusBadge status={svc.status === 'checking' ? 'unknown' : svc.status} />
                      </Box>
                      <Box className="flex justify-between items-end">
                        <Typography variant="caption" color="text.secondary" className="max-w-[200px] truncate block">
                          {svc.url}
                        </Typography>
                        {svc.latency !== undefined && (
                          <Typography variant="caption" color="success.main" className="font-bold">
                            {svc.latency}ms
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={0} className="border border-gray-200 h-full">
            <CardContent>
              <Typography variant="h6" className="font-bold mb-4">
                Current User
              </Typography>
              <Box className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, fontWeight: 'bold' }}>
                  {(username ?? 'U').charAt(0).toUpperCase()}
                </Avatar>
                <Box className="flex-1">
                  <Typography variant="h6" className="font-bold">
                    {username ?? 'Unknown'}
                  </Typography>
                  <Box className="flex gap-2 flex-wrap mt-1">
                    {(roles ?? []).map((r) => (
                      <Chip key={r} label={r} size="small" color="primary" variant="outlined" className="uppercase font-bold text-[10px]" />
                    ))}
                  </Box>
                </Box>
                <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={logout}>
                  Logout
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={0} className="border border-gray-200 h-full">
            <CardContent>
              <Typography variant="h6" className="font-bold mb-4">
                External Tools
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button
                    href={grafanaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    className="w-full h-full flex flex-col items-start p-4 normal-case text-left"
                    endIcon={<OpenInNewIcon className="absolute top-4 right-4 text-gray-400" />}
                  >
                    <Typography color="text.primary" className="font-bold">Grafana</Typography>
                    <Typography variant="caption" color="text.secondary">Dashboards</Typography>
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button
                    href={prometheusUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    className="w-full h-full flex flex-col items-start p-4 normal-case text-left"
                    endIcon={<OpenInNewIcon className="absolute top-4 right-4 text-gray-400" />}
                  >
                    <Typography color="text.primary" className="font-bold">Prometheus</Typography>
                    <Typography variant="caption" color="text.secondary">Metrics</Typography>
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button
                    href={keycloakAdminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    className="w-full h-full flex flex-col items-start p-4 normal-case text-left"
                    endIcon={<OpenInNewIcon className="absolute top-4 right-4 text-gray-400" />}
                  >
                    <Typography color="text.primary" className="font-bold">Keycloak</Typography>
                    <Typography variant="caption" color="text.secondary">Identity</Typography>
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
