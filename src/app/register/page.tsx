"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirebase } from "@/lib/firebase/client";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, serverTimestamp, getDoc, writeBatch, setDoc } from "firebase/firestore";

export default function RegisterPage() {
  const router = useRouter();
  const [referral, setReferral] = useState("");
  const [inviterUid, setInviterUid] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [refStatus, setRefStatus] = useState<"none" | "resolving" | "valid" | "invalid" | "required">("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get("ref") || url.searchParams.get("referral");
        if (ref) {
          setReferral(ref);
          setRefStatus("resolving");
          (async () => {
            try {
              const { db } = getFirebase();
              const snap = await getDoc(doc(db, "users", ref));
              if (snap.exists()) {
                const data = snap.data() as { displayName?: string; email?: string } | undefined;
                setInviterUid(ref);
                setInviterName(data?.displayName || data?.email || null);
                setRefStatus("valid");
              } else {
                setInviterUid(null);
                setRefStatus("invalid");
              }
            } catch {
              // Treat read errors as invalid to avoid spoofed referrals
              setInviterUid(null);
              setRefStatus("invalid");
            }
          })();
        } else {
          setRefStatus("required");
        }
      } catch {
        setRefStatus("invalid");
      }
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (refStatus !== "valid" || !inviterUid) {
      setError("Referral not found or invalid. Please get the right person to guide you.");
      return;
    }
    setLoading(true);
    try {
      const { auth, db } = getFirebase();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      // Optional: basic displayName from email prefix
      const displayName = email.split("@")[0];
      try { await updateProfile(user, { displayName }); } catch {}

      // Prepare atomic writes
      const batch = writeBatch(db);
      const userRef = doc(db, "users", user.uid);
      batch.set(userRef, {
        uid: user.uid,
        email: user.email ?? email,
        displayName,
        referral: inviterUid || null,
        referredByUid: inviterUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();

      // After user doc is created, best-effort create a downline record under inviter
      if (inviterUid) {
        try {
          await setDoc(doc(db, "users", inviterUid, "referral", user.uid), {
            uid: user.uid,
            email: user.email ?? email,
            displayName,
            createdAt: serverTimestamp(),
          }, { merge: true });
        } catch {
          // Ignore if rules forbid writing to inviter's subcollection
        }
      }

      router.push("/");
    } catch (err: unknown) {
      let msg = "Registration failed";
      if (err instanceof FirebaseError) {
        if (err.code === "permission-denied") {
          msg = "Invalid referral or not allowed by rules. Please check the invite link.";
        } else {
          msg = err.message;
        }
      } else if (typeof err === "object" && err && "message" in err) {
        msg = String((err as { message?: string }).message || msg);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-white/70">Sign up to get started with CXG.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {(referral || refStatus === "invalid" || refStatus === "resolving" || refStatus === "required") && (
            <div>
              <label className="block text-sm mb-1">Referral code</label>
              <input
                value={referral}
                readOnly
                placeholder="REF-1234"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
              />
              <div className="mt-1 text-xs">
                {refStatus === "resolving" && (
                  <span className="text-white/60">Validating referral…</span>
                )}
                {refStatus === "valid" && (
                  <span className="text-green-400">Invited by {inviterName || "a CXG member"}</span>
                )}
                {refStatus === "invalid" && (
                  <span className="text-red-300">Referral not found. Please get the right person to guide you.</span>
                )}
                {refStatus === "required" && (
                  <span className="text-yellow-300">Referral required. Please use an invite link shared by a member.</span>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || refStatus === "resolving" || refStatus === "invalid" || refStatus === "required"}
            className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-2.5 font-medium text-black disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-white/70">
          Already have an account? <Link href="/signin" className="text-yellow-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
