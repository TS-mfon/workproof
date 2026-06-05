"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { parseEther, parseEventLogs, zeroAddress } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";
import { Stepper } from "@/components/post/Stepper";

type FormState = {
  title: string;
  description: string;
  domain: string;
  reward: string;
  deadline: string;
  criteria: string;
  assigned: string;
};

const STEPS = ["Details", "Escrow", "Criteria", "Review"];

const initial: FormState = {
  title: "",
  description: "",
  domain: "content",
  reward: "0.005",
  deadline: defaultDeadline(),
  criteria: "",
  assigned: ""
};

function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 16);
}

export function PostWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState("");
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();

  const { data: banned } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "bannedWallets",
    args: address ? [address] : undefined,
    query: { enabled: !!workProofAddress && !!address }
  });

  // Persist to URL hash so refreshes don't lose progress
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      try {
        const decoded = JSON.parse(decodeURIComponent(hash));
        setForm((prev) => ({ ...prev, ...decoded }));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ts = Object.entries(form).filter(([, v]) => v).length > 1;
    if (ts) {
      const encoded = encodeURIComponent(JSON.stringify(form));
      window.history.replaceState(null, "", `#${encoded}`);
    }
  }, [form]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (step === 0 || step === 3) {
      if (!form.title || form.title.length < 6) e.title = "Title needs to be at least 6 characters.";
      if (form.title.length > 120) e.title = "Title is too long (120 char limit).";
      if (!form.description || form.description.length < 40) e.description = "Description needs more detail (40 chars minimum).";
      if (form.description.length > 4000) e.description = "Description is over the 4000 char limit.";
    }
    if (step === 1 || step === 3) {
      const reward = Number(form.reward);
      if (!Number.isFinite(reward) || reward <= 0) e.reward = "Reward must be a positive number.";
      if (reward > 10) e.reward = "Reward over 10 ETH — are you sure?";
      const dl = Date.parse(form.deadline);
      if (!Number.isFinite(dl) || dl < Date.now() + 60_000) e.deadline = "Deadline must be in the future.";
    }
    if (step === 2 || step === 3) {
      if (!form.criteria || form.criteria.length < 30) e.criteria = "Acceptance criteria need to be specific (30 chars minimum).";
      if (form.criteria.length > 6000) e.criteria = "Criteria over the 6000 char limit.";
    }
    if (form.assigned && (!form.assigned.startsWith("0x") || form.assigned.length !== 42)) {
      e.assigned = "Assigned address must be a valid 0x… wallet.";
    }
    return e;
  }, [form, step]);

  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  const canNext = Object.keys(errors).filter((k) => {
    const stepFields: Record<number, (keyof FormState)[]> = {
      0: ["title", "description"],
      1: ["reward", "deadline"],
      2: ["criteria", "assigned"],
      3: ["title", "description", "reward", "deadline", "criteria", "assigned"]
    };
    return (stepFields[step] || []).includes(k as keyof FormState);
  }).length === 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const addr = workProofAddress;
    if (!isConnected || !address || !addr || !publicClient) {
      setError("Connect a wallet to post.");
      return;
    }
    if (chainId !== arbitrumSepolia.id) {
      setError("Switch your wallet to Arbitrum Sepolia first.");
      return;
    }
    if (banned) {
      setError("Your wallet is restricted by an admin.");
      return;
    }
    if (!canNext) {
      setError("Fix the validation errors before posting.");
      return;
    }
    const deadlineSec = BigInt(Math.floor(Date.parse(form.deadline) / 1000));
    const assignedAddress = (form.assigned || zeroAddress) as `0x${string}`;
    // Store the project brief and criteria together so the on-chain fallback can read the full description
    // Format: PROJECT BRIEF:\n<description>\n\nACCEPTANCE CRITERIA:\n<criteria>
    const enrichedCriteria = `PROJECT BRIEF:\n${form.description}\n\nACCEPTANCE CRITERIA:\n${form.criteria}\n\nDELIVERABLES:\n- One public URL accessible by any HTTP client.`;
    const hash = await run({
      label: "Posting job",
      pending: "Locking escrow on Arbitrum…",
      success: "Job posted",
      write: () =>
        writeContractAsync({
          address: addr,
          abi: workProofAbi,
          functionName: "postJob",
          args: [form.title, "", enrichedCriteria, form.domain, deadlineSec, assignedAddress],
          value: parseEther(form.reward)
        })
    });
    if (!hash) return;
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: workProofAbi, eventName: "JobPosted", logs: receipt.logs });
      const jobId = logs[0]?.args.jobId;
      if (!jobId) {
        setError("Job posted on-chain but the JobPosted event wasn't found.");
        return;
      }
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          job_id_onchain: jobId,
          client_wallet: address,
          assigned_to_wallet: form.assigned || null,
          title: form.title,
          description: form.description,
          spec_ipfs_hash: null,
          acceptance_criteria: form.criteria,
          domain: form.domain,
          escrow_amount_wei: parseEther(form.reward).toString(),
          reward_amount_wei: parseEther(form.reward).toString(),
          status: form.assigned ? "Active" : "Open",
          deadline: new Date(Number(deadlineSec) * 1000).toISOString(),
          tx_hash: hash
        })
      }).catch(() => {});
      window.history.replaceState(null, "", "/jobs/post");
      location.href = `/jobs/${jobId}`;
    } catch (err: any) {
      setError(err?.message || "Could not finalize indexing — the on-chain post is recorded.");
    }
  }

  return (
    <div className="panel p-8">
      <Stepper steps={STEPS} active={step} />
      <form onSubmit={submit} className="grid gap-6">
        {step === 0 && (
          <StepDetails form={form} set={set} errors={errors} />
        )}
        {step === 1 && (
          <StepEscrow form={form} set={set} errors={errors} />
        )}
        {step === 2 && (
          <StepCriteria form={form} set={set} errors={errors} />
        )}
        {step === 3 && (
          <StepReview form={form} />
        )}

        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

        <div className="flex justify-between gap-3" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || isPending}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue
            </button>
          ) : (
            <button type="submit" className="btn success large" disabled={isPending || !canNext}>
              {isPending ? "Posting…" : "Post Job & Lock Escrow"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StepDetails({ form, set, errors }: { form: FormState; set: any; errors: any }) {
  return (
    <>
      <h2 className="text-xl font-bold">1. Job details</h2>
      <Field label="Title" error={errors.title}>
        <input
          className="input"
          value={form.title}
          onChange={(e) => set("title")(e.target.value)}
          placeholder="e.g. Build a responsive landing page"
          maxLength={120}
        />
      </Field>
      <Field label="Project brief" error={errors.description} hint="Audience, deliverable format, format, length.">
        <textarea
          className="textarea"
          value={form.description}
          onChange={(e) => set("description")(e.target.value)}
          placeholder="Describe the work in detail. The freelancer reads this; the AI verifier reads the criteria below."
          maxLength={4000}
        />
      </Field>
      <Field label="Domain">
        <select className="select" value={form.domain} onChange={(e) => set("domain")(e.target.value)}>
          <option value="smart-contracts">Smart contracts</option>
          <option value="frontend">Frontend</option>
          <option value="design">Design</option>
          <option value="content">Content</option>
          <option value="marketing">Marketing</option>
          <option value="research">Research</option>
        </select>
      </Field>
    </>
  );
}

function StepEscrow({ form, set, errors }: { form: FormState; set: any; errors: any }) {
  const reward = Number(form.reward) || 0;
  return (
    <>
      <h2 className="text-xl font-bold">2. Escrow &amp; deadline</h2>
      <p className="text-sm text-muted">
        Your ETH is locked in the smart contract on Arbitrum Sepolia the moment you confirm. The freelancer can only claim it after the AI verifier passes the work.
      </p>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Reward (ETH)" error={errors.reward}>
          <input
            className="input"
            type="number"
            step="0.0001"
            min={0}
            value={form.reward}
            onChange={(e) => set("reward")(e.target.value)}
          />
        </Field>
        <Field label="Deadline" error={errors.deadline}>
          <input
            className="input"
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => set("deadline")(e.target.value)}
          />
        </Field>
      </div>
      <div className="panel" style={{ background: "var(--accent-soft)", borderColor: "#DBEAFE", padding: 16 }}>
        <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--accent-strong)" }}>You will lock</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent-strong)", marginTop: 6 }} className="mono">
          {reward.toFixed(4)} ETH
        </div>
      </div>
    </>
  );
}

function StepCriteria({ form, set, errors }: { form: FormState; set: any; errors: any }) {
  const linted = lintCriteria(form.criteria);
  return (
    <>
      <h2 className="text-xl font-bold">3. Acceptance criteria</h2>
      <p className="text-sm text-muted">
        The AI verifier checks the deliverable against these criteria word-for-word. Be concrete — "good headline" doesn't help, "headline under 12 words, no jargon" does.
      </p>
      <Field label="What does the work need to include?" error={errors.criteria}>
        <textarea
          className="textarea"
          rows={8}
          value={form.criteria}
          onChange={(e) => set("criteria")(e.target.value)}
          placeholder={"Deliverable must include:\n- A markdown file at a public URL\n- Section headings: Intro, Mechanics, When to use\n- Word count between 300 and 500\n- No marketing fluff"}
          maxLength={6000}
        />
      </Field>
      {linted.length > 0 && (
        <div className="panel" style={{ background: "var(--warn-soft)", borderColor: "#FDE68A", padding: 14 }}>
          <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--warn)" }}>Heads up</div>
          <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 13, color: "#92400E" }}>
            {linted.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
      <Field label="Assign to a specific freelancer? (optional)" error={errors.assigned} hint="Skips applications and goes straight to Active.">
        <input
          className="input"
          value={form.assigned}
          onChange={(e) => set("assigned")(e.target.value)}
          placeholder="0x… or leave empty to open applications"
        />
      </Field>
    </>
  );
}

function StepReview({ form }: { form: FormState }) {
  return (
    <>
      <h2 className="text-xl font-bold">4. Review &amp; post</h2>
      <p className="text-sm text-muted">Confirm everything before signing. Once the transaction is mined, the ETH is locked.</p>
      <div className="grid gap-3" style={{ marginTop: 4 }}>
        <ReviewRow label="Title" value={form.title} />
        <ReviewRow label="Domain" value={form.domain} />
        <ReviewRow label="Reward" value={`${form.reward} ETH`} />
        <ReviewRow label="Deadline" value={new Date(form.deadline).toLocaleString()} />
        <ReviewRow label="Assigned to" value={form.assigned || "Open applications"} mono={!!form.assigned} />
        <div>
          <div className="text-xs uppercase tracking-wide font-bold text-muted">Brief</div>
          <p style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>{form.description}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide font-bold text-muted">Acceptance criteria</div>
          <pre className="mono" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: 10, padding: 14, fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{form.criteria}</pre>
        </div>
      </div>
    </>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16 }}>
      <span className="text-xs uppercase tracking-wide font-bold text-muted" style={{ alignSelf: "center" }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <label>{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

function lintCriteria(text: string): string[] {
  if (!text) return [];
  const warns: string[] = [];
  if (/\bgood\b|\bnice\b|\bquality\b/i.test(text) && !/\bquality\s+score\b/i.test(text)) {
    warns.push("Words like \"good\" or \"nice\" are too subjective — the AI verifier prefers measurable criteria.");
  }
  if (/\b(any|some|maybe|might|probably)\b/i.test(text)) {
    warns.push("Hedging words (\"any\", \"some\", \"might\") leave room for interpretation. Spell out the requirement.");
  }
  if (text.split(/\s+/).length < 25) {
    warns.push("These criteria are short — consider adding specific requirements the verifier can check.");
  }
  return warns;
}
