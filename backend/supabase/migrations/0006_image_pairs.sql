-- Image pairs: two independently stored uploads that belong together
-- (Image 1 = reference, Image 2 = comparison), and pair-aware queries.
-- Run once in the Supabase SQL editor, after 0005.
--
-- Purely additive. Both images stay ordinary `imagery` rows (own Storage
-- object, own conversation_id); existing rows keep NULL in every new column,
-- so single-image uploads and queries are unchanged.

alter table imagery
    add column if not exists pair_id uuid,
    add column if not exists pair_position smallint;

alter table imagery drop constraint if exists imagery_pair_position_check;
alter table imagery
    add constraint imagery_pair_position_check check (
        (pair_id is null and pair_position is null)
        or (pair_id is not null and pair_position in (1, 2))
    );

-- One Image 1 and one Image 2 per pair.
create unique index if not exists imagery_pair_position_uidx
    on imagery (pair_id, pair_position) where pair_id is not null;

comment on column imagery.pair_id is 'Shared by the two images of an image pair; NULL for single uploads.';
comment on column imagery.pair_position is '1 = Image 1 (reference), 2 = Image 2 (comparison); NULL for single uploads.';

-- A query about a pair: imagery_id = Image 1, comparison_imagery_id = Image 2.
alter table analysis_jobs
    add column if not exists comparison_imagery_id uuid references imagery(id);

create index if not exists analysis_jobs_comparison_imagery_id_idx
    on analysis_jobs (comparison_imagery_id);

comment on column analysis_jobs.comparison_imagery_id is 'Image 2 of an image-pair query (imagery_id is Image 1); NULL for single-image queries.';
