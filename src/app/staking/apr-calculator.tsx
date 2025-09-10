"use client";

import { useMemo, useState } from "react";

type Freq = "none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

const FREQS: Array<{ key: Freq; label: string; n: number }> = [
  { key: "none", label: "No compounding (APR)", n: 1 },
  { key: "daily", label: "Daily", n: 365 },
  { key: "weekly", label: "Weekly", n: 52 },
  { key: "monthly", label: "Monthly", n: 12 },
  { key: "quarterly", label: "Quarterly", n: 4 },
  { key: "yearly", label: "Yearly", n: 1 },
];

export default function AprCalculator() {
  const [aprStr, setAprStr] = useState("4.0");
  const [freq, setFreq] = useState<Freq>("monthly");

  const apr = useMemo(() => {
    const v = Number(aprStr);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }, [aprStr]);

  const n = useMemo(() => FREQS.find((f) => f.key === freq)?.n ?? 1, [freq]);

  const apy = useMemo(() => {
    if (freq === "none") return apr;
    const r = apr / 100;
    const comp = Math.pow(1 + r / n, n) - 1;
    return comp * 100;
  }, [apr, n, freq]);

  const setPreset = (v: number) => setAprStr(String(v));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-white/70">APR (annual %)</label>
          <input
            value={aprStr}
            onChange={(e) => setAprStr(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="4.0"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-white/70">Compounding</label>
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value as Freq)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
          >
            {FREQS.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
        Presets:
        <button onClick={() => setPreset(3.5)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10">ETH ~3.5%</button>
        <button onClick={() => setPreset(4.5)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10">BNB ~4.5%</button>
        <button onClick={() => setPreset(7.0)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10">SOL ~7.0%</button>
        <span className="ml-auto">n = {n.toLocaleString()} times/year</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/60">APR</div>
          <div className="mt-1 text-lg">{apr.toFixed(2)}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/60">APY</div>
          <div className="mt-1 text-lg">{apy.toFixed(2)}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/60">1,000 tokens in 1y</div>
          <div className="mt-1 text-lg">{(1000 * (1 + (freq === "none" ? apr/100 : Math.pow(1 + (apr/100)/n, n) - 1))).toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-white/60">
        These are illustrative calculations. Actual yields vary by validator performance, fees, and network conditions.
      </div>
    </div>
  );
}
