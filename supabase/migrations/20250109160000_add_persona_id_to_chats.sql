-- Migration: Add persona_id to chats table
-- Purpose: Store the persona used in each chat for default voice selection
-- Affected tables: chats
-- Special considerations: Add foreign key reference to personas table

-- Add persona_id column to chats table
alter table public.chats 
add column persona_id uuid references public.personas(id) on delete set null;

-- Add index for better query performance
create index idx_chats_persona_id on public.chats(persona_id);

-- Add comment explaining the new column
comment on column public.chats.persona_id is 'Reference to the persona used in this chat for default voice selection'; 