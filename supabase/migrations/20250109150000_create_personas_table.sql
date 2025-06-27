-- Migration: Create personas table for storing character personas
-- Purpose: Store persona data including name, tone, and voice settings
-- Affected tables: personas
-- Special considerations: Uses UUID for primary key, enables RLS for public access

-- Create personas table to store character persona information
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  tone text not null,
  voice_name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
comment on table public.personas is 'Stores character persona information including personality traits and voice settings';

-- Add indexes for better query performance
create index idx_personas_name on public.personas(name);
create index idx_personas_voice_name on public.personas(voice_name);

-- Enable Row Level Security
alter table public.personas enable row level security;

-- RLS Policies for personas table - allowing public read access since personas are shared content
-- Allow anyone to view all personas
create policy "Anyone can view all personas" 
on public.personas 
for select 
to anon, authenticated 
using (true);

-- Restrict insert/update/delete to authenticated users only (for admin management)
create policy "Only authenticated users can create personas" 
on public.personas 
for insert 
to authenticated 
with check (true);

create policy "Only authenticated users can update personas" 
on public.personas 
for update 
to authenticated 
using (true) 
with check (true);

create policy "Only authenticated users can delete personas" 
on public.personas 
for delete 
to authenticated 
using (true);

-- Create trigger to automatically update timestamps
create trigger update_personas_updated_at
  before update on public.personas
  for each row
  execute function public.update_updated_at_column(); 