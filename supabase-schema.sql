-- Run this in your Supabase project's SQL Editor
-- Creates tables and storage for draw-sign-pro cloud features

-- 1. Signatures table
create table if not exists signatures (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null default '',
  data_url text not null,
  created_at timestamptz default now() not null
);

alter table signatures enable row level security;

create policy "Users can view own signatures"
  on signatures for select
  using (auth.uid() = user_id);

create policy "Users can insert own signatures"
  on signatures for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own signatures"
  on signatures for delete
  using (auth.uid() = user_id);

-- 2. Documents table
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  original_filename text not null,
  storage_path text,
  page_count integer default 0,
  signature_count integer default 0,
  signed_at timestamptz default now() not null
);

alter table documents enable row level security;

create policy "Users can view own documents"
  on documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on documents for insert
  with check (auth.uid() = user_id);

-- 3. Signing sessions (multi-party)
create table if not exists signing_sessions (
  id uuid default gen_random_uuid() primary key,
  document_name text not null,
  document_storage_path text,
  document_hash text not null,
  status text default 'pending' check (status in ('pending','in_progress','completed','expired')),
  created_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  completed_at timestamptz,
  share_token text unique not null default gen_random_uuid()::text
);

alter table signing_sessions enable row level security;

create policy "Creator can manage sessions"
  on signing_sessions for all
  using (auth.uid() = created_by);

create policy "Anyone can view session by token"
  on signing_sessions for select
  using (true);

-- 4. Signing participants
create table if not exists signing_participants (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references signing_sessions(id) on delete cascade not null,
  email text not null,
  name text not null default '',
  color text not null default '#3b82f6',
  role text default 'signer' check (role in ('sender','signer','viewer')),
  status text default 'pending' check (status in ('pending','viewed','signed','declined')),
  fields jsonb not null default '[]',
  signed_at timestamptz,
  created_at timestamptz default now()
);

alter table signing_participants enable row level security;

create policy "Session creator can manage participants"
  on signing_participants for all
  using (
    exists (
      select 1 from signing_sessions s
      where s.id = signing_participants.session_id
      and s.created_by = auth.uid()
    )
  );

create policy "Anyone can view participants by session"
  on signing_participants for select
  using (true);

-- 3. Storage bucket for signed documents
insert into storage.buckets (id, name, public)
values ('signed-documents', 'signed-documents', false)
on conflict (id) do nothing;

create policy "Users can view own signed documents"
  on storage.objects for select
  using (
    bucket_id = 'signed-documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload signed documents"
  on storage.objects for insert
  with check (
    bucket_id = 'signed-documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
