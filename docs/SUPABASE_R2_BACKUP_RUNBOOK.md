# GULI MARKET — Supabase Storage backup to private Cloudflare R2

## Safety contract

- This is a backup-only operation. It never deletes or updates Supabase objects.
- It writes only to the dedicated private bucket `guli-market-backup`.
- It does not use or modify the existing `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, or `R2_PUBLIC_URL` used by the live media bucket.
- The script defaults to dry-run. Uploads require the explicit `--execute` flag.
- Every uploaded object is downloaded back from R2 and checked for identical byte length and SHA-256 before it is added as verified in the manifest.
- Each run uses a unique timestamped prefix, so a retry does not overwrite an earlier backup.
- No production application route imports this script.

## Required environment

Existing Supabase server credentials:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Existing Cloudflare account identifier:
- `CLOUDFLARE_ACCOUNT_ID`

New backup-only R2 credentials:
- `R2_BACKUP_ACCESS_KEY_ID`
- `R2_BACKUP_SECRET_ACCESS_KEY`
- `R2_BACKUP_BUCKET=guli-market-backup`
- Optional: `R2_BACKUP_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`

The backup token must be scoped to Object Read & Write on only `guli-market-backup`. Do not paste credentials into GitHub, source code, chat, or screenshots. Add them only as encrypted Render environment variables on the isolated preview service.

## Run

From the backend directory:

```bash
node scripts/backup-supabase-storage-to-r2.js
```

The default dry-run lists all six expected source buckets and object counts/bytes without downloading or uploading file data.

After confirming the dry-run inventory and setting the backup-only credentials:

```bash
node scripts/backup-supabase-storage-to-r2.js --execute
```

The script backs up:
- `reels-media`
- `video-ads`
- `chat-media`
- `payment-receipts`
- `product-images`
- `review-images`

Objects are stored under `supabase-storage-backup/<run-id>/<source-bucket>/<original-path>`. A JSON manifest is written under the same run prefix. The manifest contains source paths, byte lengths, MIME types, SHA-256 hashes, timestamps, and verification status.

## Required operational sequence

1. Review this change in a draft PR.
2. Deploy/test only on the preview Render service; do not change production.
3. Create a fresh short-lived backup-only token scoped to `guli-market-backup`.
4. Add the four backup environment variables to the preview service only.
5. Run dry-run and compare the discovered inventory with the Supabase dashboard.
6. Run `--execute` once; wait for the final `BACKUP_UPLOAD_COMPLETE` line.
7. Verify the manifest and object count in the private R2 bucket.
8. Keep all original Supabase objects unchanged until a separate migration plan and application endpoint verification are approved.

## Stop conditions

The script aborts if an expected source bucket is missing, size metadata is absent/invalid, a file's downloaded byte length differs from its metadata, an upload fails, or R2 read-back SHA-256 verification fails. A failed run may leave partial objects under its unique run prefix; it never deletes source data. Preserve the failed prefix for investigation and start a new run only after diagnosing the cause.
