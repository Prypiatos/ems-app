"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Encode Basic Auth credentials
      const authHeader = btoa(`${username}:${password}`);
      
      // Test the credentials by making a small request to Kong
      await api.get('/nodes', {
        headers: {
          'Authorization': `Basic ${authHeader}`
        }
      });

      // If successful, save credentials and redirect
      localStorage.setItem('ems_auth', authHeader);
      router.push('/dashboard');
      // Force a window reload to ensure the layout/sidebar updates if needed
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error("Login Error:", err);
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app text-fg">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border-subtle bg-panel p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white shadow-md">
            E3
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-muted">Please enter your credentials to access the system</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="mt-1 block w-full rounded-xl border border-border-subtle bg-soft px-4 py-3 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full rounded-xl border border-border-subtle bg-soft px-4 py-3 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 p-3 text-center text-sm font-medium text-red-500 border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-xl bg-accent px-4 py-4 text-sm font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>

        <div className="text-center text-xs text-muted pt-4 uppercase tracking-widest opacity-50 font-semibold">
          Protected by Kong Gateway
        </div>
      </div>
    </div>
  );
}
