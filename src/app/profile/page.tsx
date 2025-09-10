"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirebase } from "@/lib/firebase/client";
import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, query, where } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { auth, db, storage } = getFirebase();
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropPreview, setCropPreview] = useState<string>("");
  const [cropBlob, setCropBlob] = useState<Blob | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "settings" | "referrals">("overview");

  const tabs = [
    { key: "overview", title: "Overview" },
    { key: "settings", title: "Settings" },
    { key: "referrals", title: "Referrals" },
  ] as const;
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
          const data = snap.data() as { displayName?: string; photoURL?: string } | undefined;
          const dn = data?.displayName ?? u.displayName ?? (u.email ? u.email.split("@")[0] : "");
          setDisplayName(dn);
          setPhotoURL(data?.photoURL || u.photoURL || "");
          setMyUid(u.uid);
  } catch {
          // Fallback to auth profile if Firestore read fails
          setDisplayName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
          setPhotoURL(u.photoURL || "");
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
      photoURL: photoURL || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Keep Auth profile in sync
      try {
        await updateProfile(authUser, { displayName: displayName || undefined, photoURL: photoURL || undefined });
      } catch {}

      setSaved(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onPickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;
    // Basic validations
    const okType = /image\/(jpeg|png|webp)/.test(file.type);
    if (!okType) { toast.error("Use JPG/PNG/WebP images"); e.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 MB image"); e.target.value = ""; return; }
    // Prepare auto center-cropped square preview (512x512)
    try {
      const processed = await autoCenterCropToSquare(file, 512);
      const previewUrl = await blobToDataUrl(processed);
      setCropBlob(processed);
      setCropPreview(previewUrl);
      setCropOpen(true);
  } catch {
      toast.error("Could not prepare image");
      e.target.value = "";
    }
  }

  async function confirmUploadCropped() {
    if (!authUser || !cropBlob) return;
    try {
      setUploading(true);
      setUploadPct(0);
      const path = `users/${authUser.uid}/avatar.webp`;
      const ref = storageRef(storage, path);
      const task = uploadBytesResumable(ref, cropBlob, { contentType: "image/webp", cacheControl: "public,max-age=604800,immutable" });
      task.on("state_changed", (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)));
      await task;
      const url = await getDownloadURL(ref);
      await setDoc(doc(db, "users", authUser.uid), { photoURL: url, photoUpdatedAt: serverTimestamp() }, { merge: true });
      try { await updateProfile(authUser, { photoURL: url }); } catch {}
      setPhotoURL(url);
      toast.success("Profile photo updated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      setUploadPct(0);
      setCropOpen(false);
      setCropBlob(null);
      setCropPreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!authUser) return;
    try {
      setUploading(true);
      // Try delete common variants (ignore errors)
      const paths = ["avatar.jpg", "avatar.png", "avatar.webp"].map((p) => storageRef(storage, `users/${authUser.uid}/${p}`));
      await Promise.all(paths.map((r) => deleteObject(r).catch(() => {})));
      // Clear in Firestore + Auth
      await setDoc(doc(db, "users", authUser.uid), { photoURL: null, photoUpdatedAt: serverTimestamp() }, { merge: true });
      try { await updateProfile(authUser, { photoURL: null as unknown as undefined }); } catch {}
      setPhotoURL("");
      toast.success("Photo removed");
    } catch (err) {
      toast.error("Could not remove photo");
    } finally {
      setUploading(false);
    }
  }

  // Utilities: crop image to square and return Blob (WebP)
  function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function blobToDataUrl(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function autoCenterCropToSquare(file: File, size: number) {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    // cover logic
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (size - w) / 2;
    const dy = (size - h) / 2;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.92));
    if (!blob) throw new Error("Encode failed");
    return blob;
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
    <>
    <div className="min-h-dvh px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
            {/* Header card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0">
              <div className="relative h-28 w-full bg-[radial-gradient(600px_200px_at_10%_-40px,rgba(212,175,55,0.12),transparent)]" />
              <div className="px-6 pb-6 -mt-10">
                <div className="flex items-end gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-yellow-400/40">
                    {photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoURL} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-yellow-500/20 to-amber-700/20 text-yellow-300">
                        <span className="text-lg font-semibold">{(displayName || email || "").trim().charAt(0).toUpperCase() || "U"}</span>
                      </div>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 grid place-items-center bg-black/60 text-xs text-white">{uploadPct}%</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-semibold tracking-tight">{displayName || email || "Unnamed"}</div>
                    <div className="text-sm text-white/70 truncate">{email}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <button type="button" onClick={onPickFile} disabled={uploading} className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 hover:bg-white/15 disabled:opacity-60">Change photo</button>
                      {photoURL && (
                        <button type="button" onClick={removePhoto} disabled={uploading} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-rose-200 hover:bg-rose-500/15 disabled:opacity-60">Remove</button>
                      )}
                      {photoURL && (
                        <a href={photoURL} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 hover:bg-white/15">View</a>
                      )}
                      <input ref={fileInputRef} onChange={onFileChange} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" />
                    </div>
                  </div>
                </div>
                {/* Quick stats */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] text-white/60">UID</div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="truncate">{myUid || "—"}</span>
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] hover:bg-white/10"
                        onClick={async () => { if (myUid) { try { await navigator.clipboard.writeText(myUid); toast.success("UID copied"); } catch {} } }}
                      >Copy</button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] text-white/60">Downlines</div>
                    <div className="mt-1 text-sm">{loadingDownlines ? "…" : downlines.length}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-1 col-span-2">
                    <div className="text-[11px] text-white/60">Referral</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{refLink || "Generating…"}</span>
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10"
                        onClick={async () => { if (refLink) { try { await navigator.clipboard.writeText(refLink); toast.success("Link copied"); } catch {} } }}
                      >Copy</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md ${activeTab === tab.key ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'}`}
                >
                  {tab.title}
                </button>
              ))}
            </div>

            {/* Panels */}
            {activeTab === "overview" && (
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-base font-medium">Invite friends</h2>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input value={refLink} readOnly placeholder="Generating…" className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none" />
                    <div className="flex gap-2">
                      <button onClick={async () => { if (refLink) { try { await navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success('Link copied'); } catch {} } }} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/15" type="button">{copied ? "Copied" : "Copy"}</button>
                      <button onClick={async () => { if (refLink && typeof navigator !== 'undefined' && 'share' in navigator) { try { await (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share?.({ title: 'Join CXG', text: 'Sign up with my link', url: refLink, }); } catch {} } }} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/15" type="button">Share</button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-white/60">Referrals tracked automatically. Downlines appear once they register.</p>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <form onSubmit={onSave} className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm mb-1">Email</label>
                      <input type="email" value={email} readOnly className="w-full cursor-not-allowed rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white/70 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Display name</label>
                      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600" />
                    </div>
                  </div>
                  {error && (<div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>)}
                  {saved && (<div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">Profile updated.</div>)}
                  <button type="submit" disabled={loading} className="mt-4 w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-2.5 font-medium text-black disabled:opacity-60">{loading ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            )}

            {activeTab === "referrals" && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
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
            )}

            <div className="mt-6 text-sm text-white/70">
              <Link href="/" className="hover:underline">← Back to home</Link>
            </div>
          </div>
        </div>
    {/* Crop preview modal */}
    {cropOpen && (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center" onClick={() => setCropOpen(false)}>
        <div className="w-full max-w-sm px-6" onClick={(e) => e.stopPropagation()}>
          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-xl">
            <h3 className="text-base font-medium">Preview</h3>
            <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cropPreview} alt="Cropped preview" className="w-full aspect-square object-cover" />
            </div>
            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button onClick={() => setCropOpen(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10">Cancel</button>
              <button onClick={confirmUploadCropped} className="rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 px-3 py-1.5 font-medium text-black">Use photo</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
