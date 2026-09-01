const fs = require('fs');

const sql = fs.readFileSync('supabase/payment_audit_log_hardening_20260902.sql', 'utf8');
const required = [
  'create table if not exists public.payment_audit_log',
  'order_id uuid not null references public.orders(id) on delete restrict',
  'event_type text not null',
  'create or replace function public.guli_payment_audit_log()',
  'trg_guli_payment_audit_log',
  "after update of payment_status,payment_receipt_path,payment_verified_at,stock_reserved,promo_reserved,reservation_released_at",
  'reservation_released',
  'reservation_restored',
  'revoke all on public.payment_audit_log from public, anon, authenticated',
  'grant select, insert on public.payment_audit_log to service_role',
];

for (const marker of required) {
  if (!sql.includes(marker)) throw new Error(`Missing payment audit-log marker: ${marker}`);
}

if (/grant\s+(all|update|delete)\s+on\s+public\.payment_audit_log\s+to\s+service_role/i.test(sql)) {
  throw new Error('Audit log must not grant UPDATE/DELETE/ALL to service_role');
}

if (!/Payment audit log requires public\.orders\.id uuid/i.test(sql)) {
  throw new Error('Audit log migration must fail closed unless orders.id is UUID');
}

console.log('Payment audit-log static audit: PASS');
