-- notifications table for in-app notifications
-- Lightweight: persisted per user, read/unread state, no push infrastructure.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,           -- 'invite_accepted' | 'contribution_added' | 'goal_updated'
  title       text not null,
  body        text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Each user can only see their own notifications
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Service role (edge functions) can insert notifications for any user
create policy "Service role can insert notifications"
  on public.notifications for insert
  with check (true);

-- Index for the primary read pattern: unread count + list by user
create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read, created_at desc);
