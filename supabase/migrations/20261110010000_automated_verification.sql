create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table if not exists public.verification_history (
  id uuid primary key default gen_random_uuid(),
  fact_id uuid not null references public.facts(id) on delete cascade,
  previous_status text,
  new_status text not null,
  confidence_score integer check (confidence_score between 0 and 100),
  evidence_sources jsonb not null default '[]'::jsonb,
  verification_notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null check (function_name in ('fetch-facts', 'reverify-facts')),
  status text not null check (status in ('running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  facts_collected integer not null default 0,
  facts_verified integer not null default 0,
  facts_pending integer not null default 0,
  facts_rejected integer not null default 0,
  error_count integer not null default 0,
  details jsonb not null default '{}'::jsonb
);

alter table public.facts
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('verified', 'partially_verified', 'disputed', 'unverified', 'rejected')),
  add column if not exists confidence_score integer check (confidence_score between 0 and 100),
  add column if not exists evidence_sources jsonb not null default '[]'::jsonb,
  add column if not exists verification_notes text not null default '',
  add column if not exists verification_checked_at timestamptz,
  add column if not exists published_at timestamptz;

alter table public.pipeline_runs add column if not exists facts_pending integer not null default 0;

update public.facts
set verified = false,
    verification_status = 'unverified',
    confidence_score = null,
    evidence_sources = '[]'::jsonb,
    verification_notes = 'Awaiting automated source verification.',
    verification_checked_at = null,
    published_at = null
where verification_checked_at is null and evidence_sources = '[]'::jsonb;

alter table public.facts alter column verified set default false;
alter table public.facts add column if not exists image_attribution text;
alter table public.facts add column if not exists image_license text;
alter table public.facts add column if not exists discussion_url text;

create index if not exists facts_public_published_idx on public.facts (published_at desc) where verified and published_at is not null;
create index if not exists facts_verification_status_idx on public.facts (verification_status, verification_checked_at);
create index if not exists verification_history_fact_created_idx on public.verification_history (fact_id, created_at desc);
create index if not exists pipeline_runs_started_idx on public.pipeline_runs (started_at desc);

alter table public.admin_users enable row level security;
alter table public.verification_history enable row level security;
alter table public.pipeline_runs enable row level security;

create or replace function public.is_fact_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_fact_admin() from public;
grant execute on function public.is_fact_admin() to anon, authenticated;

drop policy if exists "Anyone can read approved facts" on public.facts;
drop policy if exists "Admins can read every fact" on public.facts;
drop policy if exists "Admins can update facts" on public.facts;
drop policy if exists "Public can read verified published facts" on public.facts;
drop policy if exists "Admins can inspect and manage all facts" on public.facts;
create policy "Public can read verified published facts"
  on public.facts for select to anon, authenticated
  using (verified and verification_status = 'verified' and published_at is not null);
create policy "Admins can inspect and manage all facts"
  on public.facts for all to authenticated
  using (public.is_fact_admin())
  with check (public.is_fact_admin());

drop policy if exists "Anyone can submit a report" on public.reports;
drop policy if exists "Admins can view reports" on public.reports;
drop policy if exists "Public can report published facts" on public.reports;
create policy "Public can report published facts"
  on public.reports for insert to anon, authenticated
  with check (
    char_length(btrim(reason)) between 3 and 500
    and exists (
      select 1 from public.facts
      where id = fact_id and verified and verification_status = 'verified' and published_at is not null
    )
  );
create policy "Admins can view reports"
  on public.reports for select to authenticated
  using (public.is_fact_admin());

drop policy if exists "Admins can inspect verification history" on public.verification_history;
create policy "Admins can inspect verification history"
  on public.verification_history for select to authenticated
  using (public.is_fact_admin());
drop policy if exists "Admins can inspect pipeline runs" on public.pipeline_runs;
create policy "Admins can inspect pipeline runs"
  on public.pipeline_runs for select to authenticated
  using (public.is_fact_admin());

create or replace function public.track_fact_verification_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.verification_history (
      fact_id, previous_status, new_status, confidence_score, evidence_sources, verification_notes
    ) values (
      new.id, null, new.verification_status, new.confidence_score,
      new.evidence_sources, new.verification_notes
    );
  elsif old.verification_status is distinct from new.verification_status
    or old.confidence_score is distinct from new.confidence_score
    or old.evidence_sources is distinct from new.evidence_sources then
    insert into public.verification_history (
      fact_id, previous_status, new_status, confidence_score, evidence_sources, verification_notes
    ) values (
      new.id, old.verification_status, new.verification_status, new.confidence_score,
      new.evidence_sources, new.verification_notes
    );
  end if;
  return new;
end;
$$;

drop trigger if exists track_fact_verification_history on public.facts;
create trigger track_fact_verification_history
  after insert or update on public.facts
  for each row execute function public.track_fact_verification_history();
drop policy if exists "Users can read their own admin role" on public.admin_users;
create policy "Users can read their own admin role"
  on public.admin_users for select to authenticated
  using (id = (select auth.uid()));

revoke all on public.facts from anon, authenticated;
grant select (
  id, title, body, category, tags, image_url, source_url, source_name, views, likes,
  verified, created_at, verification_status, confidence_score, evidence_sources,
  verification_checked_at, published_at, image_attribution, image_license, discussion_url
) on public.facts to anon, authenticated;
grant select (verification_notes) on public.facts to authenticated;
grant update on public.facts to authenticated;
revoke all on public.reports from anon, authenticated;
grant insert (fact_id, reason) on public.reports to anon, authenticated;
grant select on public.reports to authenticated;
revoke all on public.admin_users, public.verification_history, public.pipeline_runs from anon, authenticated;
grant select on public.admin_users, public.verification_history, public.pipeline_runs to authenticated;
revoke all on function public.track_fact_verification_history() from public, anon, authenticated;
revoke all on function public.approve_fact(uuid) from public, anon, authenticated;
revoke all on function public.reject_fact(uuid) from public, anon, authenticated;

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
      and verification_status = 'verified' and published_at is not null
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
      and verification_status = 'verified' and published_at is not null
    returning likes into updated_likes;
  return coalesce(updated_likes, 0);
end;
$$;

revoke all on function public.increment_views(uuid) from public;
revoke all on function public.increment_likes(uuid) from public;
grant execute on function public.increment_views(uuid) to anon, authenticated;
grant execute on function public.increment_likes(uuid) to anon, authenticated;

create or replace function public.report_fact(fact_id uuid, reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare report_id uuid;
begin
  if reason is null or char_length(btrim(reason)) < 3 or char_length(reason) > 500 then
    raise exception 'Report reason must contain between 3 and 500 characters';
  end if;
  insert into public.reports (fact_id, reason)
  values (fact_id, btrim(reason))
  returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.get_trending_facts(result_limit integer default 3)
returns table (
  id uuid, title text, body text, category text, tags text[], image_url text,
  source_url text, source_name text, views integer, likes integer, verified boolean,
  created_at timestamptz, verification_status text, confidence_score integer,
  evidence_sources jsonb, verification_checked_at timestamptz, published_at timestamptz,
  image_attribution text, image_license text, discussion_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, f.title, f.body, f.category, f.tags, f.image_url,
    f.source_url, f.source_name, f.views, f.likes, f.verified, f.created_at,
    f.verification_status, f.confidence_score, f.evidence_sources,
    f.verification_checked_at, f.published_at, f.image_attribution,
    f.image_license, f.discussion_url
  from public.facts f
  where f.verified and f.verification_status = 'verified' and f.published_at is not null
    and f.created_at >= now() - interval '7 days'
  order by f.views * 0.4 + f.likes * 0.6 desc
  limit greatest(1, least(result_limit, 20));
$$;

create or replace function public.get_related_facts(fact_id uuid)
returns table (
  id uuid, title text, body text, category text, tags text[], image_url text,
  source_url text, source_name text, views integer, likes integer, verified boolean,
  created_at timestamptz, verification_status text, confidence_score integer,
  evidence_sources jsonb, verification_checked_at timestamptz, published_at timestamptz,
  image_attribution text, image_license text, discussion_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select candidate.id, candidate.title, candidate.body, candidate.category, candidate.tags,
    candidate.image_url, candidate.source_url, candidate.source_name, candidate.views,
    candidate.likes, candidate.verified, candidate.created_at, candidate.verification_status,
    candidate.confidence_score, candidate.evidence_sources, candidate.verification_checked_at,
    candidate.published_at, candidate.image_attribution, candidate.image_license, candidate.discussion_url
  from public.facts current_fact
  join public.facts candidate on candidate.id <> current_fact.id
  where current_fact.id = fact_id
    and candidate.verified and candidate.verification_status = 'verified' and candidate.published_at is not null
  order by
    (case when candidate.category = current_fact.category then 3 else 0 end)
    + 2 * cardinality(array(
      select unnest(candidate.tags) intersect select unnest(current_fact.tags)
    ))
    + candidate.views * 0.4 + candidate.likes * 0.6 desc
  limit 3;
$$;

grant execute on function public.report_fact(uuid, text) to anon, authenticated;
grant execute on function public.get_trending_facts(integer) to anon, authenticated;
grant execute on function public.get_related_facts(uuid) to anon, authenticated;

drop policy if exists "Admins can manage category defaults" on storage.objects;
create policy "Admins can manage category defaults"
  on storage.objects for all to authenticated
  using (bucket_id = 'category-defaults' and public.is_fact_admin())
  with check (bucket_id = 'category-defaults' and public.is_fact_admin());

create or replace function public.invoke_reverify_facts()
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
    raise exception 'Add project_url and service_role_key to Supabase Vault before scheduling reverify-facts';
  end if;
  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/reverify-facts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || service_role_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.invoke_reverify_facts() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'reverify-facts-daily';
select cron.schedule('reverify-facts-daily', '30 3 * * *', 'select public.invoke_reverify_facts();');
