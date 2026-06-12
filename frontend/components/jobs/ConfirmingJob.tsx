"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ConfirmingJob({ jobId }: { jobId: string }) {
  const router = useRouter();
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      router.refresh();
      if (attempts >= 6) clearInterval(timer);
    }, 1500);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <section className="shell py-16">
      <div className="panel p-8">
        <h1 className="text-2xl font-black">Confirming on Arbitrum</h1>
        <p className="text-sm text-muted mt-3">Job <code>{jobId}</code> is confirmed or still indexing. This page will retry automatically.</p>
      </div>
    </section>
  );
}
