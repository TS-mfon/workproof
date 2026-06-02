create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  domains text[],
  role text default 'both' check (role in ('client', 'freelancer', 'both')),
  reputation_pts integer default 0,
  jobs_posted integer default 0,
  jobs_completed integer default 0,
  jobs_failed integer default 0,
  total_earned_wei text default '0',
  banned boolean default false,
  joined_at timestamptz default now(),
  last_active timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  job_id_onchain text unique not null,
  client_wallet text not null references users(wallet_address),
  freelancer_wallet text references users(wallet_address),
  assigned_to_wallet text,
  title text not null,
  description text not null,
  spec_ipfs_hash text,
  acceptance_criteria text not null,
  domain text not null,
  escrow_amount_wei text not null,
  reward_amount_wei text not null,
  status text not null default 'Open',
  retry_count integer default 0,
  deliverable_url text,
  ai_verdict jsonb,
  deadline timestamptz not null,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id_onchain text not null references jobs(job_id_onchain) on delete cascade,
  freelancer_wallet text not null references users(wallet_address),
  cover_note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique(job_id_onchain, freelancer_wallet)
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  job_id text references jobs(job_id_onchain),
  actor_wallet text,
  target_wallet text,
  metadata jsonb,
  tx_hash text,
  created_at timestamptz default now()
);

create table if not exists claim_queue (
  id uuid primary key default gen_random_uuid(),
  job_id_onchain text unique not null references jobs(job_id_onchain) on delete cascade,
  freelancer_wallet text not null,
  reward_wei text not null,
  quality_score integer,
  ai_summary text,
  reputation_pts integer,
  status text default 'pending' check (status in ('pending', 'claimed')),
  passed_at timestamptz default now(),
  claimed_at timestamptz
);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_wallet text not null,
  action_type text not null,
  target_id text,
  reason text,
  tx_hash text,
  created_at timestamptz default now()
);

create table if not exists reputation_history (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references users(wallet_address),
  job_id_onchain text references jobs(job_id_onchain),
  points integer not null,
  reason text not null,
  tx_hash text,
  created_at timestamptz default now()
);

create index if not exists idx_users_wallet on users(wallet_address);
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_domain on jobs(domain);
create index if not exists idx_jobs_deadline on jobs(deadline);
create index if not exists idx_jobs_client on jobs(client_wallet);
create index if not exists idx_jobs_freelancer on jobs(freelancer_wallet);
create index if not exists idx_activity_job on activity_log(job_id);
create index if not exists idx_activity_created_at on activity_log(created_at desc);
create unique index if not exists idx_activity_tx_type on activity_log(tx_hash, event_type) where tx_hash is not null;
create index if not exists idx_claim_queue_wallet on claim_queue(freelancer_wallet);

alter table users enable row level security;
alter table jobs enable row level security;
alter table job_applications enable row level security;
alter table activity_log enable row level security;
alter table claim_queue enable row level security;
alter table admin_actions enable row level security;
alter table reputation_history enable row level security;

create policy "users readable by everyone" on users for select using (true);
create policy "users insert own wallet" on users for insert with check (true);
create policy "users update own wallet" on users for update using (wallet_address = current_setting('request.jwt.claims', true)::jsonb->>'wallet_address');

create policy "jobs readable by everyone" on jobs for select using (true);
create policy "jobs insert client wallet" on jobs for insert with check (true);

create policy "applications readable by everyone" on job_applications for select using (true);
create policy "applications insert own wallet" on job_applications for insert with check (true);

create policy "activity readable by everyone" on activity_log for select using (true);
create policy "claim queue own wallet" on claim_queue for select using (freelancer_wallet = current_setting('request.jwt.claims', true)::jsonb->>'wallet_address');
create policy "reputation readable by everyone" on reputation_history for select using (true);

-- Service role bypasses RLS and is used by API routes/oracle for writes to jobs, activity_log,
-- claim_queue, admin_actions, and reputation_history.
