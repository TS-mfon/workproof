"use client";

import { useEffect } from "react";

export function SwKillerAndBuildChip() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          try { await r.unregister(); } catch {}
        }
      } catch {}
    })();
  }, []);

  const sha = process.env.NEXT_PUBLIC_BUILD_SHA;
  if (!sha) return null;

  return (
    <div
      title={`build ${sha}`}
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 9999,
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 6,
        background: "rgba(15, 23, 42, 0.55)",
        color: "white",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        pointerEvents: "none",
        opacity: 0.55
      }}
    >
      build {sha.slice(0, 7)}
    </div>
  );
}
