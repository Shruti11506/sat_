-- Adds the columns needed by POST /api/v1/imagery/upload.
-- Run once in the Supabase SQL editor, after schema.sql.
--
-- Safe to run on the current project: the `imagery` table is empty (verified
-- before writing this migration), so `file_path` is renamed to `storage_path`
-- rather than left as a redundant duplicate column. No data is deleted.

alter table imagery rename column file_path to storage_path;

alter table imagery
    add column if not exists original_filename text,
    add column if not exists bucket text,
    add column if not exists mime_type text,
    add column if not exists file_size bigint;

comment on column imagery.storage_path is 'Path inside the Supabase Storage bucket, e.g. imagery/{uuid}/{filename}';
comment on column imagery.bucket is 'Supabase Storage bucket name, e.g. Satquery';
comment on column imagery.storage_url is 'Resolved signed or public URL, if any -- not guaranteed to still be valid.';
