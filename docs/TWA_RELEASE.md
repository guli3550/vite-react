# GULI MARKET TWA release signing

The Android wrapper uses Trusted Web Activity with package ID `uz.gulii.market`.

## Required GitHub Actions secrets

Create these repository secrets before running **Build GULI MARKET TWA Release**:

- `GULI_TWA_KEYSTORE_B64` — base64-encoded production/release Java keystore.
- `GULI_TWA_KEYSTORE_PASSWORD` — keystore password.
- `GULI_TWA_KEY_PASSWORD` — private-key password for the signing alias.
- `GULI_TWA_KEY_ALIAS` — exact key alias.

Never commit the keystore, passwords, or private key to Git.

### Play App Signing

If the app will be distributed through Google Play with Play App Signing enabled, also add:

- `GULI_PLAY_APP_SIGNING_SHA256` — SHA-256 fingerprint of the **Play app-signing certificate**, copied from Google Play Console.

The workflow also records the release keystore certificate fingerprint. The generated Digital Asset Links file can contain both fingerprints, which supports direct release APK testing and the Play-signed app.

## Running the release build

Open GitHub Actions → **Build GULI MARKET TWA Release** → **Run workflow**.

The workflow:

1. Restores the release keystore only in the ephemeral runner.
2. Generates the TWA Android project from `twa-manifest.json`.
3. Builds a signed APK and App Bundle with Bubblewrap.
4. Extracts the real SHA-256 certificate fingerprint.
5. Generates `assetlinks.json` under the workflow artifact.
6. Verifies the APK signature.

## Publishing Digital Asset Links

Do **not** publish a placeholder fingerprint.

After the first successful release run, inspect the generated `twa-assetlinks/assetlinks.json`. Once the fingerprint(s) are confirmed, copy that exact file to:

`public/.well-known/assetlinks.json`

The production endpoint must then be:

`https://gulii.uz/.well-known/assetlinks.json`

It must be served over HTTPS without a redirect.

The current TWA manifest declares only `gulii.uz`. If `www.gulii.uz` is later added as an additional app-link host, the same Digital Asset Links file must also be served from that host.

## Important signing rule

Do not replace an existing production signing key casually. The certificate fingerprint is part of the Android↔website trust relationship. If Google Play App Signing is used, keep the Play app-signing fingerprint in `assetlinks.json` even if the upload/release key changes.
