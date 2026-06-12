-- WorkProof v2 — badges, quests, streaks

create table if not exists badges (
  slug text primary key,
  name text not null,
  description text not null,
  icon text not null,
  rarity text default 'common'
);

create table if not exists user_badges (
  wallet_address text not null,
  badge_slug text not null references badges(slug),
  earned_at timestamptz default now(),
  primary key (wallet_address, badge_slug)
);

create index if not exists idx_user_badges_wallet on user_badges(wallet_address);

create table if not exists quests (
  slug text primary key,
  title text not null,
  description text not null,
  target integer not null,
  reward_xp integer not null,
  reward_badge_slug text references badges(slug),
  week_start date not null default date_trunc('week', now())::date
);

create table if not exists quest_progress (
  wallet_address text not null,
  quest_slug text not null references quests(slug),
  progress integer default 0,
  completed_at timestamptz,
  week_start date not null,
  primary key (wallet_address, quest_slug, week_start)
);

create index if not exists idx_quest_progress_wallet on quest_progress(wallet_address);

alter table badges enable row level security;
alter table user_badges enable row level security;
alter table quests enable row level security;
alter table quest_progress enable row level security;

drop policy if exists "badges public" on badges;
create policy "badges public" on badges for select using (true);
drop policy if exists "user_badges public" on user_badges;
create policy "user_badges public" on user_badges for select using (true);
drop policy if exists "quests public" on quests;
create policy "quests public" on quests for select using (true);
drop policy if exists "quest_progress public" on quest_progress;
create policy "quest_progress public" on quest_progress for select using (true);

-- Seed catalogue
insert into badges (slug, name, description, icon, rarity) values
  ('first-job',       'First Win',       'Completed your first job',                       '🌱', 'common'),
  ('flawless-five',   'Flawless Five',   'Five Passed verdicts in a row',                  '🎯', 'rare'),
  ('speedrunner',     'Speedrunner',     'Passed a job within 24h of posting',             '⚡', 'rare'),
  ('top-ten',         'Top 10',          'Cracked the leaderboard top 10',                 '👑', 'epic'),
  ('marathoner',      'Marathoner',      '25 jobs completed',                              '🏃', 'epic'),
  ('night-owl',       'Night Owl',       'Submitted work between 00:00 and 05:00 UTC',     '🦉', 'common'),
  ('phoenix',         'Phoenix',         'Passed on retry after a Failed verdict',         '🔥', 'rare'),
  ('weekly-grinder',  'Weekly Grinder',  'Hit 100 XP in a single calendar week',           '💪', 'common')
on conflict (slug) do nothing;
