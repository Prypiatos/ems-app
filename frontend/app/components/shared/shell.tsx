'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from 'next/link';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import DashboardIcon from '@mui/icons-material/Dashboard';
import TimelineIcon from '@mui/icons-material/Timeline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import BoltIcon from '@mui/icons-material/Bolt';

import { useAuth } from '../auth-provider';

const drawerWidth = 260;

type ShellProps = {
  children: React.ReactNode;
  connected?: boolean;
  title?: string;
  tabs?: { label: string; index: number }[];
  tabValue?: number;
  onTabChange?: (val: number) => void;
};

export function Shell({ children, connected = false, title, tabs, tabValue, onTabChange }: ShellProps) {
  const { username, logout, roles } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const mainNav = [
    { label: 'Dashboard', icon: <DashboardIcon />, href: '/' },
  ];

  const analysisNav = [
    { label: 'Stream Summary', icon: <TimelineIcon />, href: '/stream-summary' },
    { label: 'Anomalies', icon: <WarningAmberIcon />, href: '/anomalies' },
    { label: 'Recommendations', icon: <LightbulbIcon />, href: '/recommendations' },
  ];

  const activeTitle = title ?? [...mainNav, ...analysisNav].find(i => i.href === pathname)?.label ?? 'EMS';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: sidebarOpen ? drawerWidth : 72,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: sidebarOpen ? drawerWidth : 72,
            boxSizing: 'border-box',
            transition: 'width 0.2s ease-in-out',
            borderRight: '1px solid rgba(0, 0, 0, 0.08)',
            overflowX: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center', height: 64 }}>
          {sidebarOpen ? (
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <BoltIcon /> EMS
            </Typography>
          ) : (
            <BoltIcon color="primary" />
          )}
          {sidebarOpen && (
            <IconButton onClick={() => setSidebarOpen(false)} size="small">
              <ChevronLeftIcon />
            </IconButton>
          )}
        </Box>
        <Divider sx={{ opacity: 0.6 }} />
        
        <List sx={{ px: 1.5, py: 2 }}>
          <Typography variant="caption" sx={{ px: 2, pb: 1, fontWeight: 700, color: 'text.secondary', display: sidebarOpen ? 'block' : 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
            Main
          </Typography>
          {mainNav.map((item) => (
            <ListItem key={item.label} disablePadding sx={{ display: 'block', mb: 0.5 }}>
              <Link href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemButton
                  selected={pathname === item.href}
                  sx={{
                    minHeight: 48,
                    justifyContent: sidebarOpen ? 'initial' : 'center',
                    px: 2.5,
                    borderRadius: 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'white' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: pathname === item.href ? 'white' : 'inherit' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} sx={{ opacity: sidebarOpen ? 1 : 0, '& .MuiTypography-root': { fontWeight: pathname === item.href ? 700 : 500 } }} />
                </ListItemButton>
              </Link>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ mx: 2, my: 1, opacity: 0.6 }} />

        <List sx={{ px: 1.5, py: 2 }}>
          <Typography variant="caption" sx={{ px: 2, pb: 1, fontWeight: 700, color: 'text.secondary', display: sidebarOpen ? 'block' : 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
            Analysis
          </Typography>
          {analysisNav.map((item) => (
            <ListItem key={item.label} disablePadding sx={{ display: 'block', mb: 0.5 }}>
              <Link href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemButton
                  selected={pathname === item.href}
                  sx={{
                    minHeight: 48,
                    justifyContent: sidebarOpen ? 'initial' : 'center',
                    px: 2.5,
                    borderRadius: 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'white' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: pathname === item.href ? 'white' : 'inherit' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} sx={{ opacity: sidebarOpen ? 1 : 0, '& .MuiTypography-root': { fontWeight: pathname === item.href ? 700 : 500 } }} />
                </ListItemButton>
              </Link>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 'auto', p: 2 }}>
          <Button
            variant="soft"
            fullWidth
            onClick={logout}
            startIcon={sidebarOpen ? <LogoutIcon /> : null}
            sx={{
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              minWidth: 0,
              color: 'error.main',
              fontWeight: 700,
              borderRadius: 2,
              '&:hover': { bgcolor: 'error.light', color: 'error.dark' }
            }}
          >
            {sidebarOpen ? 'Logout' : <LogoutIcon />}
          </Button>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', bgcolor: 'white', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ px: 4, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {!sidebarOpen && (
                <IconButton onClick={() => setSidebarOpen(true)} size="small" edge="start">
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mr: 4 }}>
                {activeTitle}
              </Typography>

              {tabs && (
                <Tabs 
                  value={tabValue} 
                  onChange={(_, v) => onTabChange?.(v)}
                  textColor="primary"
                  indicatorColor="primary"
                  sx={{ 
                    minHeight: 64,
                    '& .MuiTab-root': { 
                      minHeight: 64, 
                      fontWeight: 700,
                      textTransform: 'none',
                      fontSize: '0.925rem'
                    } 
                  }}
                >
                  {tabs.map((t) => (
                    <Tab key={t.label} label={t.label} />
                  ))}
                </Tabs>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? 'success.main' : 'error.main', boxShadow: connected ? '0 0 8px #22c55e' : 'none' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: connected ? 'success.main' : 'error.main' }}>
                  {connected ? 'Live System' : 'System Offline'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 2, borderLeft: '1px solid rgba(0, 0, 0, 0.08)' }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14, fontWeight: 'bold' }}>
                  {(username ?? 'U').charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {username ?? 'User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {roles.includes('admin') ? 'Administrator' : roles.includes('operator') ? 'Operator' : 'Guest'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 4, flexGrow: 1 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
