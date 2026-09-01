const fs = require('fs');
const sql = fs.readFileSync('supabase/checkout_concurrency_hardening_20260902.sql', 'utf8');
const required = [
  "create unique index if not exists orders_order_number_unique_idx",
  "on public.orders (order_number)",
  "having count(*) > 1",
  "raise exception 'Checkout concurrency migration blocked: duplicate order_number values exist'",
  "create or replace function public.guli_checkout_idempotency_lock()",
  "pg_advisory_xact_lock",
  "guli:checkout:",
  "aaa_guli_checkout_idempotency_lock",
  "revoke all on function public.guli_checkout_idempotency_lock() from public, anon, authenticated",
  "grant execute on function public.guli_checkout_idempotency_lock() to service_role",
];
for (const marker of required) {
  if (!sql.includes(marker)) throw new Error(`Missing checkout concurrency marker: ${marker}`);
}
console.log(`Checkout concurrency static audit passed (${required.length} checks).`);
