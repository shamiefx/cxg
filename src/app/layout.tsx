import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavFrame from "@/components/nav-frame";
import CanonicalRedirect from "@/components/canonical-redirect";
import SecurityGuards from "@/components/security-guards";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CXG Platform",
  description: "CXG platform with sleek UI, analytics, and integrations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var canonical = '${(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://coin-of-gold.web.app").replace(/'/g, "\\'").replace(/\/$/, "")}';
                  var loc = window.location;
                  if (loc.origin.indexOf('firebaseapp.com') !== -1 && loc.origin.indexOf(canonical) !== 0) {
                    var target = canonical + loc.pathname + loc.search + loc.hash;
                    window.location.replace(target);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div id="app-root" className="app-root">
          <SecurityGuards />
          <CanonicalRedirect />
          <NavFrame>
            {children}
          </NavFrame>
        </div>
      </body>
    </html>
  );
}
