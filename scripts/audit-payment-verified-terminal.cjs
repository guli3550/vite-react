const fs = require('fs');

const sql = fs.readFileSync('supabase/payment_verified_terminal_20260902.sql', 'utf8');
const reservation = fs.readFileSync('supabase/payment_reservation_hardening_20260901.sql', 'utf8');

const required = [
  'create or replace function public.guli_verified_payment_terminal_guard()',
  "old.payment_status = 'verified'",
  "new.payment_status <> 'verified'",
  "old.payment_status = 'verified'",
  'new.payment_verified_at is null',
  'trg_guli_verified_payment_terminal',
  'revoke all on function public.guli_verified_payment_terminal_guard() from public, anon, authenticated',
  'grant execute on function public.guli_verified_payment_terminal_guard() to service_role',
];

for (const marker of required) {
  if (!sql.includes(marker)) {
    throw new Error(`Missing terminal-state guard marker: ${marker}`);
  }
}

if (/old\.payment_status\s*=\s*'verified'[\s\S]{0,500}new\.payment_status\s+not\s+in\s*\([^)]*'rejected'/i.test(sql)) {
  throw new Error('Terminal guard must not allow verified -> rejected');
}

if (!reservation.includes("payment_status not in ('rejected')")) {
  throw new Error('Reservation release must remain limited to rejected/timeout states');
}

console.log('Payment verified-terminal static audit: PASS');
