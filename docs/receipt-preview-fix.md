# Receipt preview fix

Private payment receipts are stored in the `payment-receipts` Supabase bucket. Browser admin screens must resolve `payment_receipt_path` through `/api/admin/orders/:id/payment-receipt` to receive a short-lived signed URL.
