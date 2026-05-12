'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Desktop: expanded vs icon-only. Mobile: overlay open/closed.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const mainNav = [
    { label: 'Dashboard', icon: <DashboardIcon />, href: '/' },
  ];

  const analysisNav = [
    { label: 'Anomalies', icon: <WarningAmberIcon />, href: '/anomalies' },
    { label: 'Recommendations', icon: <LightbulbIcon />, href: '/recommendations' },
  ];

  const activeTitle = title ?? [...mainNav, ...analysisNav].find(i => i.href === pathname)?.label ?? 'EMS';

  // Mobile drawer is always full-width expanded; desktop follows sidebarOpen
  const isExpanded = isMobile || sidebarOpen;

  const handleNavClick = () => { if (isMobile) setMobileOpen(false); };
  const handleClose = () => { if (isMobile) setMobileOpen(false); else setSidebarOpen(false); };

  const navItem = (item: { label: string; icon: React.ReactNode; href: string }) => (
    <ListItem key={item.label} disablePadding sx={{ display: 'block', mb: 0.5 }}>
      <Link href={item.href} style={{ textDecoration: 'none', color: 'inherit' }} onClick={handleNavClick}>
        <ListItemButton
          selected={pathname === item.href}
          sx={{
            minHeight: 48,
            justifyContent: isExpanded ? 'initial' : 'center',
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
          <ListItemIcon sx={{ minWidth: 0, mr: isExpanded ? 2 : 'auto', justifyContent: 'center', color: pathname === item.href ? 'white' : 'inherit' }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText primary={item.label} sx={{ opacity: isExpanded ? 1 : 0, '& .MuiTypography-root': { fontWeight: pathname === item.href ? 700 : 500 } }} />
        </ListItemButton>
      </Link>
    </ListItem>
  );

  const drawerContent = (
    <>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'space-between' : 'center', height: 64 }}>
        {isExpanded ? (
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <BoltIcon /> EMS
          </Typography>
        ) : (
          <BoltIcon color="primary" />
        )}
        {isExpanded && (
          <IconButton onClick={handleClose} size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>
      <Divider sx={{ opacity: 0.6 }} />

      <List sx={{ px: 1.5, py: 2 }}>
        <Typography variant="caption" sx={{ px: 2, pb: 1, fontWeight: 700, color: 'text.secondary', display: isExpanded ? 'block' : 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
          Main
        </Typography>
        {mainNav.map(navItem)}
      </List>

      <Divider sx={{ mx: 2, my: 1, opacity: 0.6 }} />

      <List sx={{ px: 1.5, py: 2 }}>
        <Typography variant="caption" sx={{ px: 2, pb: 1, fontWeight: 700, color: 'text.secondary', display: isExpanded ? 'block' : 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
          Analysis
        </Typography>
        {analysisNav.map(navItem)}
      </List>

      <Box sx={{ mt: 'auto', p: 2 }}>
        <Button
          variant="outlined"
          fullWidth
          onClick={logout}
          startIcon={isExpanded ? <LogoutIcon /> : null}
          sx={{
            justifyContent: isExpanded ? 'flex-start' : 'center',
            minWidth: 0,
            color: 'error.main',
            fontWeight: 700,
            borderRadius: 2,
            '&:hover': { bgcolor: 'error.light', color: 'error.dark' },
          }}
        >
          {isExpanded ? 'Logout' : <LogoutIcon />}
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Mobile: temporary overlay drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop: permanent collapsible drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
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
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', bgcolor: 'white', zIndex: (t) => t.zIndex.drawer + 1 }}
        >
          <Toolbar sx={{ px: { xs: 2, md: 4 }, justifyContent: 'space-between', minHeight: { xs: 56, md: 64 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, minWidth: 0, overflow: 'hidden' }}>
              {/* Hamburger — always on mobile, only when collapsed on desktop */}
              <IconButton
                onClick={() => setMobileOpen(true)}
                size="small"
                edge="start"
                sx={{ display: { xs: 'flex', md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>
              {!sidebarOpen && (
                <IconButton
                  onClick={() => setSidebarOpen(true)}
                  size="small"
                  edge="start"
                  sx={{ display: { xs: 'none', md: 'flex' } }}
                >
                  <MenuIcon />
                </IconButton>
              )}

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  fontSize: { xs: '1rem', md: '1.25rem' },
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  mr: { xs: 0, md: 2 },
                }}
              >
                {activeTitle}
              </Typography>

              {tabs && (
                <Tabs
                  value={tabValue}
                  onChange={(_, v) => onTabChange?.(v)}
                  textColor="primary"
                  indicatorColor="primary"
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  sx={{
                    minHeight: { xs: 56, md: 64 },
                    '& .MuiTab-root': {
                      minHeight: { xs: 56, md: 64 },
                      fontWeight: 700,
                      textTransform: 'none',
                      fontSize: { xs: '0.8rem', md: '0.925rem' },
                      px: { xs: 1.5, md: 2 },
                    },
                  }}
                >
                  {tabs.map((t) => (
                    <Tab key={t.label} label={t.label} />
                  ))}
                </Tabs>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 3 }, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? 'success.main' : 'error.main', boxShadow: connected ? '0 0 8px #22c55e' : 'none', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: connected ? 'success.main' : 'error.main', display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}>
                  {connected ? 'Live System' : 'System Offline'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: { xs: 1, sm: 2 }, borderLeft: '1px solid rgba(0, 0, 0, 0.08)' }}>
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

        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, px: { xs: 1.5, sm: 2, md: 3 }, flexGrow: 1 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
