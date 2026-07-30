-- Trava handle_new_user: SECURITY DEFINER só para o trigger de signup,
-- não via POST /rest/v1/rpc/handle_new_user (anon/authenticated).
--
-- Rode no Supabase → SQL Editor → Run.
-- Depois: Advisors → Security → Rerun.
--
-- HaveIBeenPwned (alerta separado): NÃO é SQL.
-- Dashboard → Authentication → Providers → Email →
-- "Prevent use of leaked passwords" (plano Pro+).

begin;

-- Garante search_path fixo (boa prática com SECURITY DEFINER)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'visitor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
-- Trigger em auth.users continua ok (criado por role privilegiada; EXECUTE
-- não é rechecado a cada INSERT). service_role não precisa chamar via RPC.

commit;
