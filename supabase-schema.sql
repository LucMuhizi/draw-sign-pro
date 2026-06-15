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
