-- Settings page. Run once in the Supabase SQL editor, after 0004.
--
-- Purely additive and re-runnable: creates `user_settings`, one row per
-- profile, holding app preferences, notification preferences and privacy
-- toggles. Profile fields (display_name, username, bio, avatar) stay in
-- `profiles` -- nothing is duplicated here. No existing row is modified.
--
-- The row is created lazily by the backend (settings_service) the first time
-- settings are read, with the same defaults as below. Identity follows 0004:
-- no login, the backend resolves the single workspace profile itself and
-- never accepts a profile/user id from the client.

create table if not exists user_settings (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references profiles(id) on delete cascade,

    theme text not null default 'dark'
        check (theme in ('dark', 'light', 'system')),
    language text not null default 'en'
        check (language in ('en')),
    sidebar_density text not null default 'comfortable'
        check (sidebar_density in ('comfortable', 'compact')),
    -- Defaults offered when starting an analysis; never forced on a query.
    default_data_type text not null default 'optical_rgb'
        check (default_data_type in ('optical_rgb', 'multispectral', 'sar', 'optical_sar')),
    default_analysis_task text not null default 'scene_description'
        check (default_analysis_task in (
            'scene_description', 'vqa', 'change_analysis', 'water_body_analysis', 'land_cover_analysis'
        )),

    -- Preferences only: nothing sends notifications yet.
    notify_analysis_completion boolean not null default true,
    notify_product_updates boolean not null default false,
    notify_usage_alerts boolean not null default true,

    save_analysis_results boolean not null default true,
    share_usage_analytics boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Same model as every other table (0004): the backend's service-role key
-- bypasses RLS; with no policies the anon/publishable key has no access.
alter table user_settings enable row level security;
