"use client";

import { useEffect } from "react";

export default function CanonicalRedirect() {
  useEffect(() => {
    try {
      const canonical = (process.env.NEXT_PUBLIC_APP_URL || "https://coin-of-gold.web.app").replace(/\/$/, "");
      const { origin, pathname, search, hash } = window.location;
      if (origin.includes("firebaseapp.com") && !origin.startsWith(canonical)) {
        const target = `${canonical}${pathname}${search}${hash}`;
        window.location.replace(target);
      }
    } catch {
      // ignore
    }
  }, []);
  return null;
}
