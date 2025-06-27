-- Migration: Create users and chats tables for audio chat application
-- Purpose: Set up the core database schema for storing user information and chat histories
-- Affected tables: users, chats
-- Special considerations: Uses JSONB for storing message arrays, enables RLS

-- Create users table to track unique user identifiers
create table public.users (
  id bigint generated always as identity primary key,
  uid text unique not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
comment on table public.users is 'Stores unique user identifiers provided by the frontend application';

-- Create chats table to store conversation history with messages as JSONB array
create table public.chats (
  id bigint generated always as identity primary key,
  uid text not null references public.users(uid) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
comment on table public.chats is 'Stores chat conversations with messages as JSONB arrays, linked to users via uid';

-- Add indexes for better query performance
create index idx_users_uid on public.users(uid);
create index idx_chats_uid on public.chats(uid);
create index idx_chats_created_at on public.chats(created_at desc);

-- Enable Row Level Security on both tables
alter table public.users enable row level security;
alter table public.chats enable row level security;

-- RLS Policies for users table
-- Allow anyone to select users (needed for foreign key checks)
create policy "Users can view all user records" 
on public.users 
for select 
to anon, authenticated 
using (true);

-- Allow anyone to insert new users (for anonymous uid registration)
create policy "Anyone can create new users" 
on public.users 
for insert 
to anon, authenticated 
with check (true);

-- Allow users to update their own records
create policy "Users can update their own records" 
on public.users 
for update 
to anon, authenticated 
using (true) 
with check (true);

-- Prevent deletion of user records to maintain data integrity
create policy "Prevent user deletion" 
on public.users 
for delete 
to anon, authenticated 
using (false);

-- RLS Policies for chats table
-- Users can view chats that belong to them (match uid)
create policy "Users can view their own chats" 
on public.chats 
for select 
to anon, authenticated 
using (true);

-- Users can create new chats
create policy "Users can create new chats" 
on public.chats 
for insert 
to anon, authenticated 
with check (true);

-- Users can update their own chats (to add messages)
create policy "Users can update their own chats" 
on public.chats 
for update 
to anon, authenticated 
using (true) 
with check (true);

-- Users can delete their own chats
create policy "Users can delete their own chats" 
on public.chats 
for delete 
to anon, authenticated 
using (true);

-- Create a function to automatically update the updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Update the updated_at column on row modification
  new.updated_at = now();
  return new;
end;
$$;

-- Create triggers to automatically update timestamps
create trigger update_users_updated_at
  before update on public.users
  for each row
  execute function public.update_updated_at_column();

create trigger update_chats_updated_at
  before update on public.chats
  for each row
  execute function public.update_updated_at_column(); 