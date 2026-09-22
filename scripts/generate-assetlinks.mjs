import fs from "node:fs/promises";

const packageName = process.env.GULI_ANDROID_PACKAGE || "uz.gulii.market";
const releaseFingerprint = (process.env.GULI_RELEASE_SHA256 || "").trim().toUpperCase();
const playFingerprint = (process.env.GULI_PLAY_APP_SIGNING_SHA256 || "").trim().toUpperCase();

if (!releaseFingerprint && !playFingerprint) {
  throw new Error(
    "No certificate fingerprint supplied. Set GULI_RELEASE_SHA256 and/or GULI_PLAY_APP_SIGNING_SHA256."
  );
}

const fingerprints = [...new Set([releaseFingerprint, playFingerprint].filter(Boolean))];

const payload = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: packageName,
      sha256_cert_fingerprints: fingerprints
    }
  }
];

const output = process.env.GULI_ASSETLINKS_OUTPUT || "public/.well-known/assetlinks.json";
await fs.mkdir(output.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await fs.writeFile(output, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`Generated ${output} for ${packageName} with ${fingerprints.length} certificate fingerprint(s).`);
