"use client";

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

type RangeMode = "24h" | "7d";

type KlineTuple = [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  // ...rest we ignore
  ...unknown[]
];

export default function BNBCandles({ className }: { className?: string }) {
  const [mode, setMode] = useState<RangeMode>("24h");
  const [klines, setKlines] = useState<KlineTuple[] | null>(null);
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
        const data: KlineTuple[] = await res.json();
        setKlines(data);
      } catch (e: unknown) {
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

  const lastClose = useMemo(() => {
    if (!klines || !klines.length) return null;
    return parseFloat(klines[klines.length - 1][4]);
  }, [klines]);

  const firstClose = useMemo(() => {
    if (!klines || !klines.length) return null;
    return parseFloat(klines[0][4]);
  }, [klines]);

  const changePct = useMemo(() => {
    if (!firstClose || !lastClose) return null;
    return ((lastClose - firstClose) / firstClose) * 100;
  }, [firstClose, lastClose]);

  // Prepare scales
  const { minLow, maxHigh } = useMemo(() => {
    if (!klines || !klines.length) return { minLow: 0, maxHigh: 1 };
    let minL = Number.POSITIVE_INFINITY;
    let maxH = Number.NEGATIVE_INFINITY;
    for (const [, , high, low] of klines.map((k) => [k[0], k[2], k[3], k[4]] as const)) {
      const h = parseFloat(high);
      const l = parseFloat(low);
      if (Number.isFinite(h) && h > maxH) maxH = h;
      if (Number.isFinite(l) && l < minL) minL = l;
    }
    if (!Number.isFinite(minL) || !Number.isFinite(maxH) || minL === maxH) {
      return { minLow: 0, maxHigh: 1 };
    }
    return { minLow: minL, maxHigh: maxH };
  }, [klines]);

  // Build SVG elements
  const svgContent = useMemo(() => {
    if (!klines || !klines.length) return null;
    const w = 100;
    const h = 100;
    const px = 2;
    const py = 2;
    const n = klines.length;
    const innerW = w - 2 * px;
    const innerH = h - 2 * py;
    const cw = innerW / n; // candle slot width
    const bw = Math.max(0.5, cw * 0.6); // body width
    const y = (v: number) => py + innerH - ((v - minLow) * innerH) / (maxHigh - minLow || 1e-9);

  const elements: ReactElement[] = [];
    for (let i = 0; i < n; i++) {
      const k = klines[i];
      const open = parseFloat(k[1]);
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      const close = parseFloat(k[4]);
      if (![open, high, low, close].every((v) => Number.isFinite(v))) continue;

      const xc = px + i * cw + cw / 2;
      const bullish = close >= open;
      const top = bullish ? close : open;
      const bottom = bullish ? open : close;
      const yTop = y(top);
      const yBottom = y(bottom);
      const yHigh = y(high);
      const yLow = y(low);
      const color = bullish ? "#22c55e" : "#ef4444"; // green or red

      // Wick
      elements.push(
        <line key={`w-${i}`} x1={xc} x2={xc} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
      );
      // Body (ensure a minimum visible height)
      const bodyH = Math.max(0.6, Math.abs(yBottom - yTop));
      const bodyY = Math.min(yTop, yBottom);
      elements.push(
        <rect
          key={`b-${i}`}
          x={xc - bw / 2}
          y={bodyY}
          width={bw}
          height={bodyH}
          fill={color}
          rx={0.6}
        />
      );
    }
    return elements;
  }, [klines, minLow, maxHigh]);

  return (
    <div className={`flex h-full w-full flex-col rounded-xl bg-black/60 p-3 text-xs text-white/80 ring-1 ring-white/10 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">BNB/USDT</div>
        <div className="flex items-center gap-2">
          {lastClose !== null && <span className="text-white/90">{lastClose.toFixed(2)}</span>}
          {changePct !== null && (
            <span className={changePct >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 min-h-0 grow">
        {klines && klines.length > 1 ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            {svgContent}
          </svg>
        ) : (
          <div className="grid h-full place-items-center text-white/60">{loading ? "Loading…" : error ?? "No data"}</div>
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
