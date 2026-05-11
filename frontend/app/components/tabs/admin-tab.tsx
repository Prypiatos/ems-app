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
    { name: 'E2 API', url: `/py/health`, status: 'checking' },
    { name: 'Gateway Route', url: `/py/health`, status: 'checking' },
    { name: 'Keycloak', url: `/keycloak`, status: 'checking' },
  ]);

  const checkServices = useCallback(async () => {
    // Use the configured API gateway (Kong) as the single entrypoint
    const baseKong = gatewayBase();
    const checks: ServiceStatus[] = [];

    // E2 API through the gateway
    try {
      const t0 = performance.now();
      const res = await apiFetch(`/py/health`, { signal: AbortSignal.timeout(5000) });
      checks.push({ name: 'E2 API', url: `${baseKong}/py/health`, status: res.ok ? 'up' : 'down', latency: Math.round(performance.now() - t0) });
    } catch {
      checks.push({ name: 'E2 API', url: `${baseKong}/py/health`, status: 'down' });
    }

    // Kong as the browser entrypoint to the API
    try {
      const t0 = performance.now();
      const res = await apiFetch(`/py/health`, {
        signal: AbortSignal.timeout(5000),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      checks.push({ name: 'Gateway Route', url: `${baseKong}/py/health`, status: res.ok ? 'up' : 'down', latency: Math.round(performance.now() - t0) });
    } catch {
      checks.push({ name: 'Gateway Route', url: `${baseKong}/py/health`, status: 'down' });
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

  const apiDocsUrl = `${gatewayBase()}/py/docs`;
  const keycloakAdminUrl = typeof window !== 'undefined' ? `${window.location.origin}/keycloak/admin/` : 'http://localhost/keycloak/admin/';

  return (
    <Box className="pb-8">
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1" className="font-bold" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
          Admin Panel
        </Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={checkServices} size="small">
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
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: { xs: 140, sm: 200 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
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
                    href={apiDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    className="w-full h-full flex flex-col items-start p-4 normal-case text-left"
                    endIcon={<OpenInNewIcon className="absolute top-4 right-4 text-gray-400" />}
                  >
                    <Typography color="text.primary" className="font-bold">API Docs</Typography>
                    <Typography variant="caption" color="text.secondary">FastAPI OpenAPI</Typography>
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
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button
                    href={apiDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    className="w-full h-full flex flex-col items-start p-4 normal-case text-left"
                    endIcon={<OpenInNewIcon className="absolute top-4 right-4 text-gray-400" />}
                  >
                    <Typography color="text.primary" className="font-bold">Gateway</Typography>
                    <Typography variant="caption" color="text.secondary">Same-origin proxy</Typography>
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
