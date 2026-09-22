-- retire-seed-catalog.sql — safe, idempotent, transactional retirement of
-- development catalog rows. Run ONLY when replacement production data is
-- ready: after this script, the public catalog is EMPTY until real rows are
-- loaded (see catalog.template.sql).
--
-- Safety properties (all verified on scratch via scripts/ci-db.sh):
--   * matches `name LIKE 'SEED %'` ONLY — real rows are never touched;
--   * never DELETES: products move to status 'discontinued' (already excluded
--     from the public projection by products_public_read), services move to
--     is_available = false (already excluded from services_public);
--   * quote/booking history rows keep their FK references intact;
--   * re-runnable: second run changes zero rows, still succeeds;
--   * reports counts via NOTICE for the run log.
begin;

do $$
declare
  v_products int;
begin
  update app.products
  set status = 'discontinued'
  where name like 'SEED %' and status is distinct from 'discontinued';
  get diagnostics v_products = row_count;
  raise notice 'retire-seed-catalog: % SEED product row(s) now discontinued', v_products;
end $$;

do $$
declare
  v_services int;
begin
  update app.services
  set is_available = false
  where name like 'SEED %' and is_available is distinct from false;
  get diagnostics v_services = row_count;
  raise notice 'retire-seed-catalog: % SEED service row(s) now unavailable', v_services;
end $$;

-- Categories and the branch row are NOT touched here: category names are
-- generic taxonomy (confirm/rename via Admin UI) and branch identity is set
-- via Admin Settings (RPC-validated) once Simon supplies it.

commit;
