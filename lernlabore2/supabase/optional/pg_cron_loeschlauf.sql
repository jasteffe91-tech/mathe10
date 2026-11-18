-- Optional: tägliche automatische Anwendung der Löschfristen (Supabase-Erweiterung pg_cron).
-- Vorher: Supabase → Database → Extensions → pg_cron aktivieren.
-- Löscht Gruppen nach ihrem Löschdatum (inkl. aller Ergebnisse), abgelaufene Sitzungen,
-- Protokolle fehlgeschlagener Anmeldungen (> 24 h) und alte Idempotenz-Einträge.
select cron.schedule('lernlabore-loeschlauf', '17 3 * * *', $$select lernlabor_private.purge_expired()$$);

-- Prüfen:      select * from cron.job;
-- Entfernen:   select cron.unschedule('lernlabore-loeschlauf');
