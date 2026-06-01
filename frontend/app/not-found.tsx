import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">404</p>
      <h1 className="mt-3 text-4xl font-semibold text-slate-950">WorkProof page not found</h1>
      <p className="mt-4 max-w-xl text-slate-600">
        The page may have moved, or the onchain job link may not exist yet.
      </p>
      <div className="mt-8 flex gap-3">
        <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href="/jobs">
          Browse jobs
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800" href="/">
          Go home
        </Link>
      </div>
    </main>
  );
}
