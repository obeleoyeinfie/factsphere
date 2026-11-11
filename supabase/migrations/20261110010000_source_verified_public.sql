-- Replace editorial moderation with verified-at-source publishing.
delete from public.facts where source_url is null or not verified;

alter table public.facts
  alter column source_url set not null,
  alter column verified set default true;

drop policy if exists "Admins can read every fact" on public.facts;
drop policy if exists "Admins can update facts" on public.facts;
drop policy if exists "Admins can view reports" on public.reports;
drop policy if exists "Admins can manage category defaults" on storage.objects;

revoke update, insert, delete on public.facts from anon, authenticated;
revoke select on public.reports from anon, authenticated;
grant select on public.facts to anon, authenticated;
grant insert on public.reports to anon, authenticated;

revoke all on function public.approve_fact(uuid) from public, anon, authenticated;
revoke all on function public.reject_fact(uuid) from public, anon, authenticated;
drop function if exists public.approve_fact(uuid);
drop function if exists public.reject_fact(uuid);

-- A report remains public-write-only; only service-role operators can inspect it.
comment on table public.facts is 'Only source-verified facts are stored; public reads are restricted to verified rows.';
