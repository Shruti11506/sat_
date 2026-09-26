-- TIFF/GeoTIFF previews: record where each generated preview lives and
-- whether one could be made. Run once in the Supabase SQL editor, after 0006.
--
-- Purely additive. storage_path keeps pointing at the ORIGINAL file (the
-- analysis source, never modified); the PNG preview is a separate object,
-- conventionally imagery/{uuid}/thumbnail.png next to it. Raster facts read
-- from the file (size, bands, dtype, CRS, transform, bounds, nodata) and how
-- the preview was composed are kept in the existing metadata jsonb under
-- "raster", so no further columns are needed.
--
-- Existing rows keep NULL: the backend fills in each older TIFF's preview the
-- first time it is opened and records the outcome here, so it is never
-- regenerated afterwards.

alter table imagery
    add column if not exists preview_path text,
    add column if not exists preview_status text;

alter table imagery drop constraint if exists imagery_preview_status_check;
alter table imagery
    add constraint imagery_preview_status_check
        check (preview_status is null or preview_status in ('ready', 'failed'));

comment on column imagery.preview_path is 'Storage path of the generated PNG preview (TIFF/GeoTIFF only); the original stays at storage_path.';
comment on column imagery.preview_status is '''ready'' = preview stored at preview_path; ''failed'' = none could be made (reason in metadata.raster.preview_error); NULL = not a TIFF, or not attempted yet.';
