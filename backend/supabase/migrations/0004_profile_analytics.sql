-- Profile / analytics page. Run once in the Supabase SQL editor, after 0003.
--
-- Purely additive and re-runnable: creates the `profiles` table (seeded with
-- the single workspace profile), one read-only aggregation function, and
-- enables Row Level Security. No existing row is modified or deleted.
--
-- Identity model (SIH prototype, see CLAUDE.md): there is no login. The app
-- has exactly ONE workspace profile, enforced by `profiles_singleton`, and all
-- conversations/imagery/analysis_jobs belong to it. The backend resolves that
-- profile itself (profile_service.get_current_profile) -- the frontend never
-- sends a user id. Moving to real multi-user auth later means adding
-- user_id columns + auth.uid() policies and swapping that one function.

create table if not exists profiles (
    id uuid primary key default gen_random_uuid(),
    display_name text not null check (char_length(display_name) between 1 and 60),
    username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
    headline text check (headline is null or char_length(headline) <= 60),
    bio text check (bio is null or char_length(bio) <= 160),
    plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
    -- Path inside the private Storage bucket (avatars/{profile id}/...); the
    -- API returns a fresh signed URL as avatar_url, never this raw path.
    avatar_path text,
    -- IANA name, e.g. 'Asia/Kolkata'. NULL = the backend's APP_TIMEZONE.
    timezone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- At most one row: the single workspace profile.
create unique index if not exists profiles_singleton on profiles ((true));

insert into profiles (display_name, username, headline, bio)
select 'Parth Bulbule', 'parthbulbule123', 'SatQuery AI Explorer', 'Exploring Earth, one question at a time.'
where not exists (select 1 from profiles);

-- Supports the per-day activity aggregation below.
create index if not exists analysis_jobs_created_at_idx on analysis_jobs (created_at);
create index if not exists imagery_created_at_idx on imagery (created_at);

-- ---------------------------------------------------------------------------
-- profile_dashboard: every aggregate the profile page needs, in ONE call.
-- COUNT / GROUP BY / FILTER run here in Postgres; the backend only derives
-- streaks and keyword categories from these already-aggregated rows.
-- Days are bucketed in p_timezone so "today" matches the user's calendar.
-- ---------------------------------------------------------------------------
create or replace function public.profile_dashboard(
    p_timezone text default 'UTC',
    p_recent_limit int default 10
)
returns jsonb
language sql
stable
set search_path = public
as $$
    select jsonb_build_object(
        'today', (now() at time zone p_timezone)::date,
        'totals', (
            select jsonb_build_object(
                'total_queries', count(*),
                'completed', count(*) filter (where status = 'completed'),
                'failed', count(*) filter (where status = 'failed'),
                'pending', count(*) filter (where status in ('queued', 'processing')),
                'scenes_analyzed', count(distinct imagery_id)
            )
            from analysis_jobs
        ),
        'scenes_uploaded', (select count(*) from imagery),
        'active_days', coalesce((
            select jsonb_agg(jsonb_build_object('date', day, 'query_count', n) order by day)
            from (
                select (created_at at time zone p_timezone)::date as day, count(*) as n
                from analysis_jobs
                group by 1
            ) d
        ), '[]'::jsonb),
        -- Identical queries collapse into one row with a count.
        'query_groups', coalesce((
            select jsonb_agg(jsonb_build_object('analysis_type', analysis_type, 'query', q, 'count', n))
            from (
                select analysis_type, lower(btrim(coalesce(query, ''))) as q, count(*) as n
                from analysis_jobs
                group by 1, 2
            ) g
        ), '[]'::jsonb),
        'scenes', coalesce((
            select jsonb_agg(jsonb_build_object(
                'name', i.name,
                'original_filename', i.original_filename,
                'mime_type', i.mime_type,
                'sensor', i.sensor,
                'source', i.source,
                'query_count', coalesce(j.n, 0)
            ))
            from imagery i
            left join (
                select imagery_id, count(*) as n from analysis_jobs group by 1
            ) j on j.imagery_id = i.id
        ), '[]'::jsonb),
        'recent', coalesce((
            select jsonb_agg(to_jsonb(r) order by r.created_at desc)
            from (
                select *
                from (
                    select 'upload' as kind, id, coalesce(original_filename, name) as label,
                           'uploaded' as status, null::text as analysis_type, created_at
                    from imagery
                    union all
                    select 'query', id, query, status, analysis_type, created_at
                    from analysis_jobs
                ) u
                order by created_at desc
                limit greatest(p_recent_limit, 0)
            ) r
        ), '[]'::jsonb)
    );
$$;

-- Callable by the backend (service role) only -- functions in `public` are
-- otherwise executable by the anon/publishable key through PostgREST.
revoke all on function public.profile_dashboard(text, int) from public, anon, authenticated;
grant execute on function public.profile_dashboard(text, int) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security. The backend's service-role key bypasses RLS, so the app
-- is unaffected; with no policies, the anon/publishable key can no longer
-- read or write any table (the frontend never talks to Supabase directly).
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table imagery enable row level security;
alter table analysis_jobs enable row level security;
alter table analysis_results enable row level security;
alter table evidence enable row level security;
alter table audit_logs enable row level security;
