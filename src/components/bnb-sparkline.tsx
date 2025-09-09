"use client";

import { useEffect, useMemo, useState } from "react";

type RangeMode = "24h" | "7d";

export default function BNBSparkline({ className }: { className?: string }) {
  const [mode, setMode] = useState<RangeMode>("24h");
  const [series, setSeries] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const interval = mode === "24h" ? "5m" : "1h";
        const limit = mode === "24h" ? 288 : 168; // 24h@5m, 7d@1h
        const url = `https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=${interval}&limit=${limit}`;
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Binance klines schema: [openTime, open, high, low, close, volume, ...]
        const data: [number, string, string, string, string, string, ...unknown[]][] = await res.json();
        const closes = data.map((k) => parseFloat(k[4])).filter((n: number) => Number.isFinite(n));
        setSeries(closes);
      } catch (e: unknown) {
        // Ignore abort errors during unmount or refresh
        if (typeof e === "object" && e && "name" in e && (e as { name?: string }).name === "AbortError") return;
        setError("Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [mode]);

  const first = series?.[0] ?? null;
  const last = series && series.length ? series[series.length - 1] : null;
  const changePct = useMemo(() => {
    if (!first || !last) return null;
    return ((last - first) / first) * 100;
  }, [first, last]);

  const { path, color } = useMemo(() => {
    if (!series || series.length < 2) return { path: "", color: "#22c55e" };
    // Normalize drawing to a 100x100 viewBox so the SVG can scale to fill its container
    const w = 100;
    const h = 100;
    const px = 2;
    const py = 2;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1e-9;
    const x = (i: number) => px + (i * (w - 2 * px)) / (series.length - 1);
    const y = (v: number) => py + (h - 2 * py) - ((v - min) * (h - 2 * py)) / range;
    let d = `M ${x(0)} ${y(series[0])}`;
    for (let i = 1; i < series.length; i++) d += ` L ${x(i)} ${y(series[i])}`;
    const c = last && first && last < first ? "#ef4444" : "#22c55e"; // red or green
    return { path: d, color: c };
  }, [series, first, last]);

  return (
    <div className={`flex h-full w-full flex-col rounded-xl bg-black/60 p-3 text-xs text-white/80 ring-1 ring-white/10 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">BNB/USDT</div>
        <div className="flex items-center gap-2">
          {last && <span className="text-white/90">{last.toFixed(2)}</span>}
          {changePct !== null && (
            <span className={changePct >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 min-h-0 grow">
        {series && series.length > 1 ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <path d={path} fill="none" stroke={color} strokeWidth="2" />
          </svg>
        ) : (
          <div className="grid h-full place-items-center text-white/60">
            {loading ? "Loading…" : error ?? "No data"}
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-1">
        <button
          onClick={() => setMode("24h")}
          className={`rounded px-2 py-0.5 ${mode === "24h" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10"}`}
        >
          24h
        </button>
        <button
          onClick={() => setMode("7d")}
          className={`rounded px-2 py-0.5 ${mode === "7d" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10"}`}
        >
          7d
        </button>
      </div>
    </div>
  );
}
