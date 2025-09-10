// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./global.scss";
import NavFrame from "@/components/nav-frame";
import CanonicalRedirect from "@/components/canonical-redirect";
import CanonicalDomain from "@/components/CanonicalDomain";
import SecurityGuards from "@/components/security-guards";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://coin-of-gold.web.app")
    .replace(/\/$/, "");

export const metadata: Metadata = {
  title: "CXG Platform",
  description: "CXG platform with sleek UI, analytics, and integrations.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "CXG Platform",
    description: "Buy CXGP on BNB Chain with a sleek UX.",
    siteName: "CXG+",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CXG+" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CXG Platform",
    description: "Buy CXGP on BNB Chain with a sleek UX.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* preconnects help wallet libs / fonts */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://rpc.ankr.com" />
        <link rel="preconnect" href="https://bsc-dataseed.binance.org" />

        {/* Early, safe guard: redirect firebaseapp.com → canonical host (no meta refresh) */}
        <Script id="canonical-guard" strategy="beforeInteractive">
          {`
            (function(){
              try {
                var canonical = ${JSON.stringify(SITE_URL)};
                var loc = window.location;
                // silence noisy cross-origin SecurityError from extensions/metamask content
                window.addEventListener('error', function(e){
                  var m = (e && e.message) || '';
                  if (m.indexOf("named property 'origin' from 'Location'") !== -1 ||
                      m.indexOf('Blocked a frame with origin') !== -1 ||
                      m.indexOf('SecurityError') !== -1) {
                    if (e.preventDefault) e.preventDefault();
                    return true;
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(e){
                  var r = e && e.reason; var m = '' + (r && (r.message || r)); var n = r && r.name;
                  if (n === 'SecurityError' ||
                      m.indexOf("named property 'origin' from 'Location'") !== -1 ||
                      m.indexOf('Blocked a frame with origin') !== -1) {
                    if (e.preventDefault) e.preventDefault();
                  }
                });

                // only hard-redirect if served from firebaseapp.com to keep a single origin
                if (loc.hostname.endsWith('firebaseapp.com')) {
                  var target = canonical + loc.pathname + loc.search + loc.hash;
                  if (target !== loc.href) loc.replace(target);
                }
              } catch(_) {}
            })();
          `}
        </Script>
      </head>

      {/* Keep roots free of transforms/filters to avoid off-center modals */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-black text-white [transform:none] [filter:none] [perspective:none]`}>
        {/* Enforce canonical domain (client check) */}
        <CanonicalDomain host={new URL(SITE_URL).hostname} />

        {/* Security toggles (CSP helpers, clickjacking guards, etc.) */}
        <SecurityGuards />

        {/* Optional SSR-side canonical routing/guards if you have them */}
        <CanonicalRedirect />

        {/* App chrome */}
        <div id="app-root" className="app-root">
          <NavFrame>{children}</NavFrame>
        </div>

        {/* Noscript fallback */}
        <noscript>
          This application requires JavaScript enabled to connect your wallet.
        </noscript>
      </body>
    </html>
  );
}
