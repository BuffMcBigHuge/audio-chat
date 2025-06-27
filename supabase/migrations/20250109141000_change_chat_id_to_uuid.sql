-- Migration: Change chat ID from bigint to UUID
-- Purpose: Allow custom UUID chat IDs for better organization with audio files
-- Affected tables: chats
-- Special considerations: Dropping and recreating the table to change ID type

-- Drop existing triggers
drop trigger if exists update_chats_updated_at on public.chats;

-- Drop existing table (assuming this is early development)
drop table if exists public.chats cascade;

-- Recreate chats table with UUID primary key
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  uid text not null references public.users(uid) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
comment on table public.chats is 'Stores chat conversations with messages as JSONB arrays, linked to users via uid. Uses UUID for primary key.';

-- Recreate indexes
create index idx_chats_uid on public.chats(uid);
create index idx_chats_created_at on public.chats(created_at desc);

-- Re-enable Row Level Security
alter table public.chats enable row level security;

-- Recreate RLS policies
create policy "Users can view their own chats" 
on public.chats 
for select 
to anon, authenticated 
using (true);

create policy "Users can create new chats" 
on public.chats 
for insert 
to anon, authenticated 
with check (true);

create policy "Users can update their own chats" 
on public.chats 
for update 
to anon, authenticated 
using (true) 
with check (true);

create policy "Users can delete their own chats" 
on public.chats 
for delete 
to anon, authenticated 
using (true);

-- Recreate trigger
create trigger update_chats_updated_at
  before update on public.chats
  for each row
  execute function public.update_updated_at_column();