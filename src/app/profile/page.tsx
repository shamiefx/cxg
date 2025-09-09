"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirebase } from "@/lib/firebase/client";
import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, query, where } from "firebase/firestore";

export default function ProfilePage() {
  const { auth, db } = getFirebase();
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  // Referral
  // Referral: use UID as code
  const [myUid, setMyUid] = useState("");
  const [refLink, setRefLink] = useState("");
  const [copied, setCopied] = useState(false);
  // Downlines
  const [downlines, setDownlines] = useState<Array<{ uid: string; email?: string | null; displayName?: string | null }>>([]);
  const [loadingDownlines, setLoadingDownlines] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      setChecking(false);
      if (u) {
        setEmail(u.email || "");
        // Load profile doc
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          const data = snap.data() as { displayName?: string } | undefined;
          const dn = data?.displayName ?? u.displayName ?? (u.email ? u.email.split("@")[0] : "");
          setDisplayName(dn);
          setMyUid(u.uid);
  } catch {
          // Fallback to auth profile if Firestore read fails
          setDisplayName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
        }
      }
    });
    return () => unsub();
  }, [auth, db]);

  // Build referral link on client using UID
  useEffect(() => {
    if (!myUid) return;
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setRefLink(origin ? `${origin}/register?ref=${encodeURIComponent(myUid)}` : `/register?ref=${encodeURIComponent(myUid)}`);
    } catch {}
  }, [myUid]);

  // Load downlines from subcollection and also users where referredByUid == me
  useEffect(() => {
    let cancelled = false;
    async function loadDownlines() {
      if (!authUser) return;
      setLoadingDownlines(true);
      try {
        // Subcollection entries
        const subs = await getDocs(collection(db, "users", authUser.uid, "referral"));
        const rowsFromSub = subs.docs.map((d) => {
          const v = d.data() as { uid?: string; email?: string | null; displayName?: string | null };
          return { uid: v.uid || d.id, email: v.email ?? null, displayName: v.displayName ?? null };
        });
        // Direct users query by referredByUid
        let rowsFromUsers: Array<{ uid: string; email?: string | null; displayName?: string | null }> = [];
        try {
          const qUsers = query(collection(db, "users"), where("referredByUid", "==", authUser.uid));
          const snapsUsers = await getDocs(qUsers);
          rowsFromUsers = snapsUsers.docs.map((d) => {
            const v = d.data() as { uid?: string; email?: string | null; displayName?: string | null };
            return { uid: v.uid || d.id, email: v.email ?? null, displayName: v.displayName ?? null };
          });
        } catch {
          // If rules deny reading user docs, ignore and rely on subcollection
          rowsFromUsers = [];
        }
        if (!cancelled) {
          const map = new Map<string, { uid: string; email?: string | null; displayName?: string | null }>();
          [...rowsFromSub, ...rowsFromUsers].forEach((r) => map.set(r.uid, r));
          setDownlines(Array.from(map.values()));
        }
  } catch {
        if (!cancelled) setDownlines([]);
      } finally {
        if (!cancelled) setLoadingDownlines(false);
      }
    }
    loadDownlines();
    return () => { cancelled = true; };
  }, [authUser, db]);

  useEffect(() => {
    if (!checking && !authUser) {
      router.replace("/signin");
    }
  }, [checking, authUser, router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser) return;
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      // Update Firestore profile
      await setDoc(
        doc(db, "users", authUser.uid),
        {
          uid: authUser.uid,
          email: authUser.email,
          displayName: displayName || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Keep Auth profile in sync
      try {
        await updateProfile(authUser, { displayName: displayName || undefined });
      } catch {}

      setSaved(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 py-12">
        <div className="text-white/70">Checking session…</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          Redirecting to sign in… <Link className="underline" href="/signin">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-6 py-12">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Your Profile</h1>
        <p className="mt-1 text-sm text-white/70">Update your account details for CXG.</p>

        <form onSubmit={onSave} className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white/70 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            {saved && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                Profile updated.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-2.5 font-medium text-black disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        {/* Referral */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-white/70">Your referral (UID)</div>
              <div className="text-lg font-medium tracking-tight bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 bg-clip-text text-transparent">{myUid || "—"}</div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm mb-1">Referral link</label>
            <div className="flex gap-2">
              <input
                value={refLink}
                readOnly
                placeholder="Generating…"
                className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={async () => { if (refLink) { try { await navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} } }}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                type="button"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={async () => {
                  if (refLink && typeof navigator !== "undefined" && "share" in navigator) {
                    try {
                      await (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share?.({
                        title: "Join CXG",
                        text: "Sign up with my link",
                        url: refLink,
                      });
                    } catch {}
                  }
                }}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                type="button"
              >
                Share
              </button>
            </div>
            <p className="mt-2 text-xs text-white/60">Invite friends to register with your link. Their accounts will appear as your downlines.</p>
          </div>
        </div>

        {/* Downlines */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Your downlines</h2>
            <span className="text-sm text-white/70">{loadingDownlines ? "Loading…" : `${downlines.length}`}</span>
          </div>
          <div className="mt-3 divide-y divide-white/10">
            {downlines.length === 0 && !loadingDownlines ? (
              <div className="text-sm text-white/70">No downlines yet.</div>
            ) : (
              downlines.map((d) => (
                <div key={d.uid} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{d.displayName || "—"}</div>
                    <div className="text-xs text-white/70">{d.email || "(no email)"}</div>
                  </div>
                  <div className="text-xs text-white/50">{d.uid.slice(0, 6)}…</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 text-sm text-white/70">
          <Link href="/" className="hover:underline">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
