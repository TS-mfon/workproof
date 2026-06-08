create table if not exists ingest_cursors (
  name text primary key,
  last_block bigint not null,
  updated_at timestamptz not null default now()
);

alter table ingest_cursors enable row level security;

drop policy if exists "deny all anon" on ingest_cursors;
create policy "deny all anon" on ingest_cursors for all to anon using (false) with check (false);

drop policy if exists "service role full access" on ingest_cursors;
create policy "service role full access" on ingest_cursors for all to service_role using (true) with check (true);
