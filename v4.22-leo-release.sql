-- Optional v4.22 audit field for releases completed from the LEO terminal.
-- The release feature still works without this column; this preserves the callsign in the impound record.
alter table public.impounds add column if not exists release_callsign text;
notify pgrst, 'reload schema';
