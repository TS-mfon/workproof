-- WorkProof v2 — admin command center, disputes, notifications, announcements

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_wallet text not null,
  kind text not null,
  job_id text references jobs(job_id_onchain) on delete set null,
  payload jsonb,
  seen_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_recipient on notifications(recipient_wallet, created_at desc);
create index if not exists idx_notifications_unseen on notifications(recipient_wallet) where seen_at is null;

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  kind text default 'info' check (kind in ('info', 'warn', 'success')),
  active boolean default true,
  starts_at timestamptz default now(),
  ends_at timestamptz,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists idx_announcements_active on announcements(active, starts_at desc);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  job_id_onchain text not null references jobs(job_id_onchain) on delete cascade,
  opener_wallet text not null,
  reason text not null,
  status text default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_disputes_status on disputes(status, created_at desc);
create index if not exists idx_disputes_job on disputes(job_id_onchain);

alter table notifications enable row level security;
alter table announcements enable row level security;
alter table disputes enable row level security;

create policy "notifications visible to recipient" on notifications for select using (true);
create policy "announcements public" on announcements for select using (true);
create policy "disputes public" on disputes for select using (true);
