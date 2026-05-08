'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import Keycloak from 'keycloak-js';

// ── Keycloak Configuration ──────────────────────────────────────────────────
const KEYCLOAK_URL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_KEYCLOAK_URL
  ? process.env.NEXT_PUBLIC_KEYCLOAK_URL
  : (typeof window !== 'undefined'
    ? `${window.location.origin}/keycloak`
    : 'http://localhost/keycloak');

const keycloakConfig = {
  url: KEYCLOAK_URL,
  realm: 'ems',
  clientId: 'ems-frontend',
};

// ── Auth Context ─────────────────────────────────────────────────────────────
type AuthContextType = {
  authenticated: boolean;
  token: string | undefined;
  username: string | undefined;
  roles: string[];
  login: () => void;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  token: undefined,
  username: undefined,
  roles: [],
  login: () => {},
  logout: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

// ── Auth Provider Component ──────────────────────────────────────────────────
let keycloakInstance: Keycloak | null = null;

function getKeycloak(): Keycloak {
  if (!keycloakInstance) {
    keycloakInstance = new Keycloak(keycloakConfig);
  }
  return keycloakInstance;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [username, setUsername] = useState<string | undefined>();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const kc = getKeycloak();

    kc.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
      pkceMethod: 'S256',
    })
      .then((auth) => {
        setAuthenticated(auth);
        if (auth) {
          setToken(kc.token);
          setUsername(kc.tokenParsed?.preferred_username as string);
          setRoles((kc.tokenParsed?.realm_roles as string[]) ?? []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Keycloak init failed', err);
        setLoading(false);
      });

    // Auto-refresh token before it expires
    const refreshInterval = setInterval(() => {
      kc.updateToken(30)
        .then((refreshed) => {
          if (refreshed) {
            setToken(kc.token);
          }
        })
        .catch(() => {
          console.warn('Token refresh failed, logging out');
          kc.logout();
        });
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const login = useCallback(() => {
    getKeycloak().login();
  }, []);

  const logout = useCallback(() => {
    getKeycloak().logout({ redirectUri: window.location.origin });
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0f1c',
        color: '#94a3b8',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '1.1rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #1e293b',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          Connecting to authentication server...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ authenticated, token, username, roles, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
