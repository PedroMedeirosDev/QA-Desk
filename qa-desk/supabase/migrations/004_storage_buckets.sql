-- QA Desk: Supabase Storage — evidence (privado) + avatars (público)
-- Cole no SQL Editor do projeto Supabase (ou supabase db push).

-- ---------------------------------------------------------------------------
-- profiles.avatar_path
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is
  'Caminho no bucket avatars (ex.: {userId}/avatar.jpg). Null = fallback bundle.';

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  52428800, -- 50 MB (prints + vídeos de tela)
  array[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/3gpp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies — evidence: sem acesso anon/authenticated (só service_role)
-- ---------------------------------------------------------------------------
drop policy if exists "evidence_no_anon_select" on storage.objects;
drop policy if exists "evidence_no_authenticated_select" on storage.objects;
drop policy if exists "evidence_deny_anon" on storage.objects;
drop policy if exists "evidence_deny_authenticated" on storage.objects;

-- Sem policies de INSERT/SELECT/UPDATE/DELETE para anon/authenticated:
-- o Desk sobe/baixa com SUPABASE_SERVICE_ROLE_KEY (bypassa RLS).
-- Policies explícitas de bloqueio não são necessárias; ausência = deny.

-- ---------------------------------------------------------------------------
-- Policies — avatars: leitura pública; escrita só service_role
-- ---------------------------------------------------------------------------
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- Upload/replace de avatar: Desk usa service_role (sem policy authenticated).
-- Se no futuro o client subir direto, adicionar INSERT/UPDATE/DELETE TO authenticated
-- com check em profiles.role = 'admin'.
