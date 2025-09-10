"use client";

import { useEffect } from "react";

// Install lightweight global guards to avoid noisy cross-origin SecurityError
// from third-party content scripts (e.g., inpage.js) attempting to read top.location.
export default function SecurityGuards() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      const msg = event?.message || "";
      // Swallow only the specific cross-origin location.origin access error
      if (msg.includes("named property 'origin' from 'Location'") ||
          msg.includes("Blocked a frame with origin") ||
          msg.includes("SecurityError")) {
        event.preventDefault?.();
        return true;
      }
      return false;
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason: unknown = event?.reason;
      const msg = typeof reason === "object" && reason !== null
        ? ((reason as { message?: string }).message || String(reason))
        : String(reason ?? "");
      const name = typeof reason === "object" && reason !== null
        ? ((reason as { name?: string }).name || "")
        : "";
      if (name === "SecurityError" ||
          msg.includes("named property 'origin' from 'Location'") ||
          msg.includes("Blocked a frame with origin")) {
        event.preventDefault?.();
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
  return null;
}
