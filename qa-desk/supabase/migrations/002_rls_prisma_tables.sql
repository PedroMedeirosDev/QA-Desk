-- QA Desk: RLS nas tabelas do Prisma (acesso só via API Node / role postgres).
-- O browser NÃO usa PostgREST nessas tabelas — só Auth + public.profiles.
-- Com RLS ligado e SEM policies para anon/authenticated, a API pública fica bloqueada.
-- Prisma (DATABASE_URL / role postgres) continua funcionando (owner bypassa RLS).
--
-- Rode no Supabase → SQL Editor → Run.
-- Depois: Advisors → Security → re-scan (ou aguarde o e-mail limpar).

begin;

-- Bloqueia PostgREST (anon / authenticated) de CRUD direto
alter table if exists public.projects enable row level security;
alter table if exists public.tests enable row level security;
alter table if exists public.homologations enable row level security;
alter table if exists public.test_runs enable row level security;
alter table if exists public.kb_curations enable row level security;
alter table if exists public.daily_metrics enable row level security;
alter table if exists public._prisma_migrations enable row level security;

-- Garante que anon/authenticated não tenham grants residuais
revoke all on table public.projects from anon, authenticated;
revoke all on table public.tests from anon, authenticated;
revoke all on table public.homologations from anon, authenticated;
revoke all on table public.test_runs from anon, authenticated;
revoke all on table public.kb_curations from anon, authenticated;
revoke all on table public.daily_metrics from anon, authenticated;
revoke all on table public._prisma_migrations from anon, authenticated;

-- service_role (se alguém usar o client admin) continua com acesso total
grant all on table public.projects to service_role;
grant all on table public.tests to service_role;
grant all on table public.homologations to service_role;
grant all on table public.test_runs to service_role;
grant all on table public.kb_curations to service_role;
grant all on table public.daily_metrics to service_role;
grant all on table public._prisma_migrations to service_role;

commit;

-- Conferência (todas devem ter rowsecurity = true):
-- select relname, relrowsecurity
-- from pg_class
-- where relnamespace = 'public'::regnamespace
--   and relname in (
--     'projects','tests','homologations','test_runs','kb_curations','daily_metrics','profiles','_prisma_migrations'
--   );
