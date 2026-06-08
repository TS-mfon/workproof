create table if not exists genlayer_submissions (
  id bigserial primary key,
  job_id text not null,
  submission_id text not null,
  gl_tx_id text not null,
  oracle_address text not null,
  attempt int not null default 0,
  signed_at timestamptz not null default now(),
  unique (submission_id, attempt)
);

create index if not exists idx_genlayer_submissions_job
  on genlayer_submissions (job_id);

alter table genlayer_submissions enable row level security;

drop policy if exists "deny all anon" on genlayer_submissions;
create policy "deny all anon" on genlayer_submissions for all to anon using (false) with check (false);

drop policy if exists "service role full access" on genlayer_submissions;
create policy "service role full access" on genlayer_submissions for all to service_role using (true) with check (true);
