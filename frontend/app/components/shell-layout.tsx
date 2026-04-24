"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

type ShellLayoutProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/divisions", label: "Divisions" },
  { href: "/alerts", label: "Alerts" },
  { href: "/analytics", label: "Analytics" },
];

export function ShellLayout({ children }: ShellLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check for auth credentials
    const auth = localStorage.getItem('ems_auth');
    if (!auth) {
      router.push('/login');
    } else {
      setAuthenticated(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('ems_auth');
    router.push('/login');
  };

  // If not authenticated, don't render the layout to prevent flickering
  if (!authenticated) return null;

  return (
    <div className="min-h-screen bg-app lg:grid lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] min-[1440px]:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border-subtle bg-sidebar lg:flex lg:flex-col lg:justify-between">
        <div className="p-6 xl:p-8">
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-border-subtle bg-panel p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
              E3
            </div>
            <div>
              <p className="text-sm font-semibold">Energy Core</p>
              <p className="text-xs text-muted">Management Suite</p>
            </div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-accent text-white"
                      : "bg-transparent text-fg hover:bg-soft"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 border-t border-border-subtle p-6 xl:p-8">
          <ThemeToggle />
          <div className="group relative rounded-2xl border border-border-subtle bg-panel p-4 transition-all hover:bg-soft/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Mia Chen</p>
                <p className="text-xs text-muted">Grid Operations Lead</p>
              </div>
              <button 
                onClick={handleLogout}
                className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                title="Log out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-subtle bg-app/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="rounded-xl border border-border-subtle bg-panel px-3 py-2 text-sm font-medium"
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
              E3
            </div>
            <span className="text-sm font-semibold">Energy Core</span>
          </div>
          <ThemeToggle compact />
        </header>

        {mobileOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation overlay"
            />
            <aside className="fixed inset-y-0 left-0 z-40 w-72 border-r border-border-subtle bg-sidebar p-5 lg:hidden">
              <div className="mb-6 flex items-center justify-between rounded-2xl border border-border-subtle bg-panel p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
                    E3
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Energy Core</p>
                    <p className="text-xs text-muted">Dashboard</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-border-subtle px-2 py-1 text-xs"
                  onClick={() => setMobileOpen(false)}
                >
                  Close
                </button>
              </div>

              <nav className="space-y-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-xl px-4 py-3 text-sm transition ${
                        isActive
                          ? "bg-accent text-white"
                          : "bg-transparent text-fg hover:bg-soft"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-panel p-4">
                  <div>
                    <p className="text-sm font-semibold">Mia Chen</p>
                    <p className="text-xs text-muted">Grid Operations Lead</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  </button>
                </div>
              </div>
            </aside>
          </>
        ) : null}

        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 xl:p-8 min-[1440px]:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}