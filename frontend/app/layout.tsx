"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import { ShellLayout } from "./components/shell-layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-app text-fg antialiased">
        <Providers>
          {isLoginPage ? (
            <main>{children}</main>
          ) : (
            <ShellLayout>{children}</ShellLayout>
          )}
        </Providers>
      </body>
    </html>
  );
}
