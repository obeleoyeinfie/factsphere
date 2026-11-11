create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null check (char_length(body) between 40 and 300),
  category text not null,
  tags text[] not null default '{}',
  image_url text,
  source_url text not null,
  source_name text,
  views integer not null default 0 check (views >= 0),
  likes integer not null default 0 check (likes >= 0),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  fact_id uuid not null references public.facts(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);

create index if not exists facts_verified_created_idx on public.facts (verified, created_at desc);
create index if not exists facts_verified_category_likes_idx on public.facts (category, likes desc) where verified;
create index if not exists facts_title_search_idx on public.facts using gin (to_tsvector('english', title));
create index if not exists facts_body_search_idx on public.facts using gin (to_tsvector('english', body));
create index if not exists facts_tags_idx on public.facts using gin (tags);
create index if not exists reports_created_idx on public.reports (created_at desc);

alter table public.facts enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Anyone can read approved facts" on public.facts;
create policy "Anyone can read approved facts"
  on public.facts for select to anon, authenticated
  using (verified);

drop policy if exists "Admins can read every fact" on public.facts;
create policy "Admins can read every fact"
  on public.facts for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update facts" on public.facts;
create policy "Admins can update facts"
  on public.facts for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Anyone can submit a report" on public.reports;
create policy "Anyone can submit a report"
  on public.reports for insert to anon, authenticated
  with check (
    char_length(reason) between 3 and 500
    and exists (select 1 from public.facts where id = fact_id and verified)
  );

drop policy if exists "Admins can view reports" on public.reports;
create policy "Admins can view reports"
  on public.reports for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.increment_views(fact_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare updated_views integer;
begin
  update public.facts
    set views = views + 1
    where id = fact_id and verified
    returning views into updated_views;
  return coalesce(updated_views, 0);
end;
$$;

create or replace function public.increment_likes(fact_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare updated_likes integer;
begin
  update public.facts
    set likes = likes + 1
    where id = fact_id and verified
    returning likes into updated_likes;
  return coalesce(updated_likes, 0);
end;
$$;

create or replace function public.approve_fact(fact_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin role required';
  end if;
  update public.facts set verified = true where id = fact_id and not verified;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.reject_fact(fact_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin role required';
  end if;
  delete from public.facts where id = fact_id and not verified;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.increment_views(uuid) from public;
revoke all on function public.increment_likes(uuid) from public;
revoke all on function public.approve_fact(uuid) from public;
revoke all on function public.reject_fact(uuid) from public;
grant execute on function public.increment_views(uuid) to anon, authenticated;
grant execute on function public.increment_likes(uuid) to anon, authenticated;
grant execute on function public.approve_fact(uuid) to authenticated;
grant execute on function public.reject_fact(uuid) to authenticated;
grant select on public.facts to anon, authenticated;
grant update on public.facts to authenticated;
grant insert on public.reports to anon, authenticated;
grant select on public.reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'category-defaults',
  'category-defaults',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read category defaults" on storage.objects;
create policy "Public can read category defaults"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'category-defaults');

drop policy if exists "Admins can manage category defaults" on storage.objects;
create policy "Admins can manage category defaults"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'category-defaults'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'category-defaults'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Add these two values to Supabase Vault before the first scheduled invocation.
-- select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
-- select vault.create_secret('<service-role-key>', 'service_role_key');
create or replace function public.invoke_fetch_facts()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare project_url text;
declare service_role_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_role_key from vault.decrypted_secrets where name = 'service_role_key';
  if project_url is null or service_role_key is null then
    raise exception 'Add project_url and service_role_key to Supabase Vault before scheduling fetch-facts';
  end if;
  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/fetch-facts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || service_role_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.invoke_fetch_facts() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-facts-every-six-hours';

select cron.schedule(
  'fetch-facts-every-six-hours',
  '0 */6 * * *',
  'select public.invoke_fetch_facts();'
);
