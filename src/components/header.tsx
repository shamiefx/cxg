"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { getFirebase } from "@/lib/firebase/client";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const { auth } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock scroll when menu open (mobile)
  useEffect(() => {
    const root = document.documentElement;
    if (menuOpen) {
      const prev = root.style.overflow;
      root.style.overflow = "hidden";
      return () => { root.style.overflow = prev; };
    }
  }, [menuOpen]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const toggleBtn = document.getElementById("nav-toggle-btn");
        if (toggleBtn && toggleBtn.contains(e.target as Node)) return;
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.push("/");
    } catch {
      // no-op
    }
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b border-white/10 bg-neutral-950/60">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        {/* Mobile toggle replaces logo on small devices */}
        <button
          id="nav-toggle-btn"
          type="button"
          aria-controls="mobile-nav-panel"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden mr-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-yellow-600"
        >
          <span className="sr-only">Toggle navigation</span>
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {menuOpen ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <>
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
        <Link href="/" className="hidden md:inline-flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded bg-gradient-to-br from-yellow-500 to-amber-700" />
          <span className="font-semibold tracking-tight">CXG+</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
          {[
            { href: "/#solutions", label: "Solutions" },
            { href: "/#pricing", label: "Pricing" },
            { href: "/#resources", label: "Resources" },
            { href: "/#company", label: "Company" },
          ].map(item => {
            const active = pathname === "/" && item.href.startsWith("/#") && typeof window !== 'undefined' ? window.location.hash === item.href.slice(1) : pathname === item.href;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`hover:text-white transition-colors ${active ? 'text-white' : ''}`}>{item.label}</Link>
            );
          })}
        </nav>
  <div className="flex items-center gap-3">
          {!user ? (
            <>
              <Link href="/signin" className="text-sm text-white/80 hover:text-white">Sign in</Link>
              <Link href="/register" className="text-sm text-white/80 hover:text-white">Register</Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="hidden sm:inline text-sm text-white/70 hover:text-white"
              >
                {user.displayName || user.email}
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          )}
          {user && (
            <Link
            href="/client"
            className="rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 px-4 py-2 text-sm font-medium text-black hover:from-yellow-400 hover:to-amber-500"
          >
            Client
          </Link>
          )}
        </div>
      </div>
      {/* Mobile slide-down panel */}
      <div
        id="mobile-nav-panel"
        ref={panelRef}
        className={`md:hidden transition-[max-height] duration-300 overflow-hidden border-t border-white/10 bg-neutral-950/90 backdrop-blur ${menuOpen ? 'max-h-[480px]' : 'max-h-0'}`}
      >
        <div className="px-6 py-4 flex flex-col gap-4 text-sm text-white/80">
          <div className="flex flex-col gap-2">
            {[
              { href: "/#solutions", label: "Solutions" },
              { href: "/#pricing", label: "Pricing" },
              { href: "/#resources", label: "Resources" },
              { href: "/#company", label: "Company" },
            ].map(item => (
              <Link key={item.href} href={item.href} className="hover:text-white">{item.label}</Link>
            ))}
          </div>
          <div className="h-px bg-white/10" />
          {!user ? (
            <div className="flex flex-col gap-2">
              <Link href="/signin" className="hover:text-white">Sign in</Link>
              <Link href="/register" className="hover:text-white">Register</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/profile" className="hover:text-white">{user.displayName || user.email}</Link>
              <button
                onClick={handleSignOut}
                className="text-left rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
              >Sign out</button>
              <Link href="/client" className="rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 px-3 py-2 text-black font-medium hover:from-yellow-400 hover:to-amber-500">Client Area</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
