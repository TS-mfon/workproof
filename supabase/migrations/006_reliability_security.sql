-- Replay-safe server events and wallet session support.

alter table notifications add column if not exists event_key text;
create unique index if not exists idx_notifications_event_key
  on notifications(event_key) where event_key is not null;

alter table activity_log add column if not exists event_key text;
create unique index if not exists idx_activity_event_key
  on activity_log(event_key) where event_key is not null;

-- Public clients never write these tables directly. API routes use the service role.
drop policy if exists "users insert own wallet" on users;
drop policy if exists "users update own wallet" on users;
drop policy if exists "jobs insert client wallet" on jobs;
drop policy if exists "applications insert own wallet" on job_applications;
drop policy if exists "notifications visible to recipient" on notifications;
create policy "deny notification anon reads" on notifications for select to anon using (false);
