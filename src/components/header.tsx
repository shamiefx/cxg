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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hideClientCta = pathname === "/wallet";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock scroll when menu or confirm modal is open (mobile)
  useEffect(() => {
    const root = document.documentElement;
    if (menuOpen || confirmOpen) {
      const prev = root.style.overflow;
      root.style.overflow = "hidden";
      return () => { root.style.overflow = prev; };
    }
  }, [menuOpen, confirmOpen]);

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
      if (e.key === "Escape") { setMenuOpen(false); setConfirmOpen(false); }
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
    <>
    <header className="sticky top-0 z-50 backdrop-blur border-b border-white/10 bg-neutral-950/60">
      {/* WalletConnect config hint (client-only) */}
      {(!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID === "demo") && (
        <div className="bg-amber-500/15 border-b border-amber-500/30">
          <div className="mx-auto max-w-7xl px-6 py-2 text-xs text-amber-200">
            Mobile wallets work best with WalletConnect. Open this site inside your wallet app browser (MetaMask/Trust/TokenPocket) or ask admin to set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
          </div>
        </div>
      )}
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
            { href: "/", label: "Main" },
            { href: "/staking", label: "Staking" },
            { href: "/profile", label: "Profile" },
            { href: "/wallet", label: "Wallet" },
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
            </>
          ) : (
            <div className="flex items-center gap-3">
              {/* <Link
                href="/profile"
                className="hidden sm:inline text-sm text-white/70 hover:text-white"
              >
                {user.displayName || user.email}
              </Link> */}
              <button
                onClick={() => setConfirmOpen(true)}
                aria-label="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-rose-400 hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                  <path d="M12 3v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M7 6a7 7 0 1 0 10 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
          {user && !hideClientCta && (
            <Link
              href="/wallet"
              aria-label="Wallet"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-yellow-400 hover:bg-white/10"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
              >
                <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2H6A3 3 0 0 0 3 11v-3.5Z" fill="currentColor" opacity=".35"/>
                <rect x="3" y="8" width="18" height="11" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M16 12.75h3a1.25 1.25 0 0 1 0 2.5h-3V12.75Z" fill="currentColor"/>
                <circle cx="17.5" cy="14" r=".75" fill="#000" opacity=".5"/>
              </svg>
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
              { href: "/", label: "Main" },
              { href: "/staking", label: "Staking" },
              // Only show Wallet if logged in
              ...(user ? [{ href: "/wallet", label: "Wallet" }] : []),
              { href: "/profile", label: "Profile" },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-white"
                {...(item.href === "/wallet" && !user ? { tabIndex: -1, 'aria-disabled': 'true', onClick: (e) => e.preventDefault() } : {})}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="h-px bg-white/10" />
          {!user ? (
            <div className="flex flex-col gap-2">
              <Link href="/signin" className="hover:text-white">Sign in</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* <Link href="/profile" className="hover:text-white">{user.displayName || user.email}</Link> */}
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-400">
                  <path d="M12 3v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M7 6a7 7 0 1 0 10 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                Sign out
              </button>
              {!hideClientCta && (
                <Link href="/wallet" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white/90 hover:bg-white/10 inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400">
                    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2H6A3 3 0 0 0 3 11v-3.5Z" fill="currentColor" opacity=".35"/>
                    <rect x="3" y="8" width="18" height="11" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M16 12.75h3a1.25 1.25 0 0 1 0 2.5h-3V12.75Z" fill="currentColor"/>
                  </svg>
                  Wallet
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
  </header>
    {confirmOpen && (
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center" onClick={() => setConfirmOpen(false)}>
        <div className="w-full max-w-sm px-6" onClick={(e) => e.stopPropagation()}>
          <div role="dialog" aria-modal="true" aria-labelledby="logout-title" className="rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-rose-500/15 p-2 text-rose-300">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                  <path d="M12 3v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M7 6a7 7 0 1 0 10 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 id="logout-title" className="text-base font-semibold">Sign out?</h2>
                <p className="mt-1 text-sm text-white/70">You are about to log out. Any in‑progress actions will be lost. Continue?</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button onClick={() => setConfirmOpen(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10">Cancel</button>
              <button onClick={handleSignOut} className="rounded-lg bg-gradient-to-r from-rose-500 to-red-600 px-3 py-1.5 font-medium text-white hover:from-rose-400 hover:to-red-500">Sign out</button>
            </div>
          </div>
        </div>
  </div>
    )}
    </>
  );
}
