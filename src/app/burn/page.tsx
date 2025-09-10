"use client";

import Link from "next/link";

export default function BurnPage() {
  // Example data for the template (replace with live data later)
  const stats = {
    circulating: "12,345,678.12345678 CXGP",
    burned: "1,234,567.89000000 CXGP",
    burnAddress: "0x000000000000000000000000000000000000dead",
    nextBurn: "Oct 5, 2025 14:00 UTC",
  };

  const scheduledBurns = [
    {
      id: "sb-1",
      title: "Weekly Auto-Burn",
      cadence: "Every Sunday 14:00 UTC",
      amount: "10,000 CXGP",
      status: "Scheduled",
    },
    {
      id: "sb-2",
      title: "Liquidity Burn",
      cadence: "End of Month",
      amount: "2% of fees",
      status: "Planned",
    },
  ];

  const recentBurns = [
    {
      id: "rb-1",
      hash: "0x3a2c...d9f1",
      date: "Sep 01, 2025",
      amount: "8,000 CXGP",
      url: "#",
    },
    {
      id: "rb-2",
      hash: "0x91bf...2a07",
      date: "Aug 25, 2025",
      amount: "12,500 CXGP",
      url: "#",
    },
    {
      id: "rb-3",
      hash: "0xe8aa...77c0",
      date: "Aug 18, 2025",
      amount: "10,000 CXGP",
      url: "#",
    },
  ];

  return (
    <div className="min-h-dvh px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Burn CXGP</h1>
            <p className="mt-1 text-sm text-white/70">
              Burning permanently removes CXGP from circulation. This page is a template with example data.
            </p>
          </div>
          <div className="text-sm text-white/70">
            <Link href="/client" className="hover:underline">← Back to client</Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/60">Circulating Supply</div>
            <div className="mt-2 text-lg font-medium">{stats.circulating}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/60">Total Burned</div>
            <div className="mt-2 text-lg font-medium text-rose-300">{stats.burned}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/60">Burn Wallet</div>
            <div className="mt-2 text-sm">
              <a
                href={`https://bscscan.com/address/${stats.burnAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-white/90 underline decoration-white/20 underline-offset-4 hover:text-white"
              >
                {stats.burnAddress}
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/60">Next Scheduled Burn</div>
            <div className="mt-2 text-lg font-medium">{stats.nextBurn}</div>
          </div>
        </div>

        {/* Burn form (template only) */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Burn from Wallet</h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">Template</span>
            </div>
            <p className="mt-1 text-sm text-white/60">
              Example UI. Connect wallet and wire logic later to destroy tokens by sending to the burn address.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-white/70">Amount (CXGP)</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    className="w-full bg-transparent text-lg outline-none placeholder:text-white/30"
                    disabled
                  />
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs">MAX</span>
                </div>
                <div className="mt-1 text-xs text-white/50">Wallet: 0.00000000 CXGP (example)</div>
              </div>
              <div>
                <label className="text-xs text-white/70">Destination</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <input
                    type="text"
                    value={stats.burnAddress}
                    className="w-full bg-transparent text-sm outline-none"
                    disabled
                  />
                </div>
                <div className="mt-1 text-xs text-white/50">Burn wallet is prefilled and read-only.</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80" disabled>10%</button>
              <button className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80" disabled>25%</button>
              <button className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80" disabled>50%</button>
              <button className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80" disabled>100%</button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-amber-200/80">
                Note: Burning is irreversible. This is a non-functional template.
              </div>
              <button
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white/80 ring-1 ring-white/15 hover:bg-white/15"
                disabled
              >
                Burn CXGP
              </button>
            </div>
          </div>

          {/* Scheduled burns */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Scheduled Burns</h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">Examples</span>
            </div>
            <ul className="mt-3 space-y-3">
              {scheduledBurns.map((b) => (
                <li key={b.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{b.title}</div>
                      <div className="text-xs text-white/60">{b.cadence}</div>
                    </div>
                    <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-white/70">{b.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-rose-300">{b.amount}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recent burns */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Recent Burns</h2>
            <span className="text-xs text-white/60">Examples</span>
          </div>
          <div className="mt-3 divide-y divide-white/10">
            {recentBurns.map((tx) => (
              <div key={tx.id} className="flex flex-col items-start justify-between gap-2 py-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">🔥</span>
                  <div>
                    <div className="text-sm font-medium">{tx.amount}</div>
                    <div className="text-xs text-white/60">{tx.date}</div>
                  </div>
                </div>
                <a
                  href={tx.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white/80 underline decoration-white/20 underline-offset-4 hover:text-white"
                >
                  {tx.hash}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-6 flex flex-col items-start justify-between gap-3 text-sm text-white/70 sm:flex-row sm:items-center">
          <div className="space-x-3">
            <a
              href="https://bscscan.com/token/0xA63F08a32639689DfF7b89FC5C12fF89dC687B34"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              View token on BscScan
            </a>
            <span className="opacity-40">•</span>
            <a href="/client" className="hover:underline">Go to Client</a>
          </div>
          <div className="text-xs">This page is a design template. Hook up on-chain actions later.</div>
        </div>
      </div>
    </div>
  );
}
