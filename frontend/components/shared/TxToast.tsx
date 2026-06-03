"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { explorerTxUrl } from "@/lib/contracts";

type ToastPhase = "signing" | "confirming" | "done" | "error";

type Toast = {
  id: number;
  phase: ToastPhase;
  label: string;
  hash?: `0x${string}`;
  message?: string;
};

type RunArgs = {
  label: string;
  pending?: string;
  success?: string;
  write: () => Promise<`0x${string}`>;
  onConfirmed?: (hash: `0x${string}`) => void | Promise<void>;
};

type Ctx = {
  run: (args: RunArgs) => Promise<`0x${string}` | undefined>;
};

const TxToastContext = createContext<Ctx | null>(null);

let toastCounter = 0;

export function TxToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const update = useCallback((id: number, patch: Partial<Toast>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const run = useCallback(async ({ label, pending, success, write, onConfirmed }: RunArgs) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, phase: "signing", label }]);
    try {
      const hash = await write();
      update(id, { phase: "confirming", label: pending ?? `Confirming ${label.toLowerCase()}…`, hash });
      // Optimistically mark as done after a short window — wagmi/viem will already have a receipt
      setTimeout(() => {
        update(id, { phase: "done", label: success ?? `${label} confirmed`, hash });
      }, 1200);
      setTimeout(() => remove(id), 6000);
      if (onConfirmed) {
        await onConfirmed(hash);
      }
      return hash;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      const friendly = /user rejected|denied/i.test(msg) ? "You declined the signature" : msg.split("\n")[0].slice(0, 140);
      update(id, { phase: "error", label, message: friendly });
      setTimeout(() => remove(id), 6000);
      return undefined;
    }
  }, [remove, update]);

  return (
    <TxToastContext.Provider value={{ run }}>
      {children}
      <TxToastHost toasts={toasts} onClose={remove} />
    </TxToastContext.Provider>
  );
}

export function useTx() {
  const ctx = useContext(TxToastContext);
  if (!ctx) throw new Error("useTx must be used inside TxToastProvider");
  return ctx;
}

function TxToastHost({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="tx-toast-host" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 16);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`tx-toast tx-toast-${toast.phase} ${mounted ? "mounted" : ""}`}>
      <span className={`tx-toast-icon tx-toast-icon-${toast.phase}`} aria-hidden>
        {toast.phase === "signing" || toast.phase === "confirming" ? <Spinner /> : null}
        {toast.phase === "done" ? <CheckIcon /> : null}
        {toast.phase === "error" ? <XIcon /> : null}
      </span>
      <div className="tx-toast-body">
        <div className="tx-toast-label">{toast.label}</div>
        {toast.message && <div className="tx-toast-msg">{toast.message}</div>}
        {toast.hash && toast.phase !== "error" && (
          <a className="tx-toast-link" href={explorerTxUrl(toast.hash)} target="_blank" rel="noreferrer">
            View on Arbiscan
          </a>
        )}
      </div>
      <button className="tx-toast-close" aria-label="Dismiss" onClick={onClose}>×</button>
    </div>
  );
}

function Spinner() {
  return <span className="tx-spinner" />;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
