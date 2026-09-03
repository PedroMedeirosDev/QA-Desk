-- Role `bot`: leitura do Repasse (Grok). Sem admin.
-- Rodar no SQL Editor do Supabase (ou supabase db push).

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'visitor', 'bot'));
