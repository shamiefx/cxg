"use client";

import GeckoOhlcvChart from "./GeckoOhlcvChart";

export default function GeckoChartTile({
  pool,
  interval = "1h",
  limit = 72,
}: {
  pool: string;
  interval?: "5m" | "15m" | "1h" | "4h" | "1d";
  limit?: number;
}) {
  return (
    <div className="h-full w-full">
      <GeckoOhlcvChart pool={pool} interval={interval} limit={limit} />
    </div>
  );
}
