"use client";

import Link from "next/link";

export default function BurnPage() {
  return (
    <div className="min-h-dvh px-6 py-12">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Burn CXG</h1>
        <p className="mt-1 text-sm text-white/70">This is a placeholder. You can burn CXG using BNB or USDT here.</p>
        <div className="mt-6 text-sm text-white/70">
          <Link href="/client" className="hover:underline">← Back to client</Link>
        </div>
      </div>
    </div>
  );
}
