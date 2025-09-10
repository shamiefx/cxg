"use client";

import { useEffect } from "react";

export default function CanonicalDomain({ host }: { host: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { location } = window;
    // Only enforce when not already on the preferred host
    if (location.hostname !== host) {
      // Preserve path/query/hash and force HTTPS + preferred host
      const url = new URL(location.href);
      url.hostname = host;
      url.protocol = "https:"; // ensures HTTPS
      // 308-like redirect (hard replace to avoid back-button loop)
      location.replace(url.toString());
    }
  }, [host]);

  return null;
}
