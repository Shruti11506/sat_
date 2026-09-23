-- Adds conversations: what the sidebar lists, with a title that is independent
-- of any uploaded filename. Run once in the Supabase SQL editor, after 0002.
--
-- Purely additive: no existing row is modified or deleted. Existing
-- imagery/analysis_jobs rows keep conversation_id = NULL and still appear in
-- the sidebar as legacy history -- they are NOT backfilled or auto-titled.

create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    title text not null default 'New Chat',
    -- 'default' = still "New Chat"; 'auto' = generated once from the first
    -- meaningful query; 'user' = manually renamed, never overwritten.
    title_source text not null default 'default'
        check (title_source in ('default', 'auto', 'user')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table imagery
    add column if not exists conversation_id uuid references conversations(id);

alter table analysis_jobs
    add column if not exists conversation_id uuid references conversations(id);

create index if not exists conversations_updated_at_idx on conversations (updated_at desc);
create index if not exists imagery_conversation_id_idx on imagery (conversation_id);
create index if not exists analysis_jobs_conversation_id_idx on analysis_jobs (conversation_id);
