"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

type ThemeToggleProps = {
  compact?: boolean;
};

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="h-10 rounded-xl border border-border-subtle bg-panel px-3 text-sm text-muted"
      >
        Theme
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Switch to light" : "Switch to dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-10 rounded-xl border border-border-subtle bg-panel px-3 text-sm font-medium text-fg transition hover:border-accent hover:text-accent"
      aria-label={label}
      title={label}
    >
      {compact ? (isDark ? "Dark" : "Light") : isDark ? "Dark mode" : "Light mode"}
    </button>
  );
}