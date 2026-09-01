# GULI Supabase Production Migration Manifest v1.1

## Canonical order

Run only these migrations, in this order, after validating them against a staging Supabase project:

1. `production_checkout_fix_20260901.sql`
2. `payment_security_hardening_20260901.sql`
3. `payment_reservation_hardening_20260901.sql`
4. `payment_verified_terminal_20260902.sql`
5. `payment_audit_log_hardening_20260902.sql`

## Legacy / repair SQL — do not run after the canonical checkout migration

These files contain older `create_secure_order` implementations or legacy checkout assumptions and are retained for historical/recovery reference only:

- `secure_checkout_hardening.sql`
- `checkout_runtime_repair.sql`

They must **not** be executed after `production_checkout_fix_20260901.sql`, because doing so can replace the canonical RPC with an older implementation and reintroduce UUID/bigint or reservation-state inconsistencies.

`atomic_order_repair.sql` is also non-canonical and must not be used as the production checkout migration.

## Production gate

Do not apply this manifest directly to production until staging proves all of the following:

- checkout decrements stock exactly once;
- promo usage increments exactly once;
- retry with the same order number is idempotent;
- timeout/rejection restores stock and promo usage exactly once;
- rejected receipt replacement re-reserves before upload;
- verified payment is terminal and never releases inventory;
- payment audit rows are written;
- customer and admin payment flows both pass runtime smoke tests.

The backend PR must also be CI-green before merge.
