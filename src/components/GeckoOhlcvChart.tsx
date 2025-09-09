"use client";

import { useEffect, useState } from "react";

export type GeckoChartProps = {
  pool: string;
  network?: string;
  interval?: "5m" | "15m" | "1h" | "4h" | "1d";
  limit?: number;
  height?: number;
};

function extractErrMsg(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { shortMessage?: string; details?: string; message?: string };
    return e.shortMessage || e.details || e.message || "Failed to load chart";
  }
  return "Failed to load chart";
}

export default function GeckoOhlcvChart({
  pool,
  network = "bsc",
  interval = "1h",
  limit = 72,
  height = 160,
}: GeckoChartProps) {
  const [points, setPoints] = useState<Array<{ t: number; c: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    async function fetchOhlcv(iv: GeckoChartProps["interval"]) {
      const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}/ohlcv/${iv}?aggregate=1&limit=${limit}`;
      const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      type OhlcvRow = [number, number, number, number, number, number];
      const raw = json?.data?.attributes?.ohlcv_list ?? json?.data?.attributes?.ohlcv ?? [];
      const list = (Array.isArray(raw) ? raw : []) as unknown as OhlcvRow[];
      const mapped = list
        .map((row) => ({ t: Number(row[0]) * 1000, c: Number(row[4]) })) // [ts, o, h, l, c, v]
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c));
      return mapped;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const tries: GeckoChartProps["interval"][] = Array.from(
          new Set<GeckoChartProps["interval"]>([interval, "15m", "5m", "4h", "1d"])
        );
        let got: Array<{ t: number; c: number }> = [];
        for (const iv of tries) {
          try {
            got = await fetchOhlcv(iv);
            if (got.length >= 2) break;
          } catch {
            // continue
          }
        }
        if (got.length >= 2) {
          setPoints(got);
          return;
        }
        // Fallback: fetch pool for last price and draw a flat line
        try {
          const poolUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}`;
          const r = await fetch(poolUrl, { signal: ctrl.signal, headers: { accept: "application/json" } });
          if (r.ok) {
            const j = await r.json();
            const a = j?.data?.attributes ?? {};
            const last = Number(
              a.base_token_price_usd ?? a.price_in_usd ?? a.last_price_usd ?? a.base_token_price ?? a.price
            );
            if (Number.isFinite(last) && last > 0) {
              const now = Date.now();
              setPoints([
                { t: now - 60_000, c: last },
                { t: now, c: last },
              ]);
              return;
            }
          }
        } catch {
          // ignore
        }
        setError("No chart data");
      } catch (e) {
        if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") return;
        setError(extractErrMsg(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => ctrl.abort();
  }, [network, pool, interval, limit]);

  if (loading) {
    return <div className="mt-4 text-sm text-white/70">Loading chart…</div>;
  }
  if (error || points.length < 2) {
    return <div className="mt-4 text-sm text-white/70">Chart data unavailable right now.</div>;
  }

  const W = 600; // viewBox width
  const H = height;
  const closes = points.map((p) => p.c);
  let min = Math.min(...closes);
  let max = Math.max(...closes);
  if (min === max) {
    const eps = min === 0 ? 1 : min * 0.01;
    min -= eps;
    max += eps;
  }
  const n = points.length;
  const toXY = (i: number) => {
    const x = (i / (n - 1)) * W;
    const y = H - ((points[i].c - min) / (max - min)) * H;
    return [x, y] as const;
  };
  let d = "";
  for (let i = 0; i < n; i++) {
    const [x, y] = toXY(i);
    d += (i === 0 ? "M" : " L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  const last = closes[closes.length - 1];
  const first = closes[0];
  const pct = ((last - first) / first) * 100;

  return (
    <div className="mt-2 px-1">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-white/70">Last:</span>
        <span className="font-medium">{last.toLocaleString()}</span>
        <span className={pct >= 0 ? "text-emerald-400" : "text-rose-400"}>
          ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Price chart">
        <defs>
          <linearGradient id="gt-stroke" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke="url(#gt-stroke)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
