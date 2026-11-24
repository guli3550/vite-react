"use strict";
const crypto = require("node:crypto");
const { createR2MediaStorage } = require("../r2MediaStorage");

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("Missing " + name);
  return value;
}
async function request(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error("HTTP " + response.status + " for R2 smoke request");
  return response;
}
async function main() {
  const common = {
    endpoint: required("R2_ENDPOINT"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  };
  const publicBase = required("R2_PUBLIC_URL").replace(/\/+$/, "");
  const publicStorage = createR2MediaStorage({ config: { ...common, bucket: required("R2_PUBLIC_BUCKET_NAME"), publicBase } });
  const privateStorage = createR2MediaStorage({ config: { ...common, bucket: required("R2_PRIVATE_BUCKET_NAME") } });
  const nonce = crypto.randomUUID();
  const publicKey = "__guli_r2_smoke__/" + nonce + ".txt";
  const privateKey = "__guli_r2_smoke__/" + nonce + ".txt";
  const payload = Buffer.from("GULI MARKET R2 smoke " + nonce, "utf8");
  let publicDeleted = false, privateDeleted = false;
  try {
    await publicStorage.uploadObject(publicKey, payload, { contentType: "text/plain", cacheControl: "public, max-age=60" });
    const publicHead = await publicStorage.headObject(publicKey);
    if (publicHead.contentLength != null && publicHead.contentLength !== payload.length) throw new Error("Public bucket HEAD size mismatch (expected " + payload.length + ", got " + publicHead.contentLength + ")");
    const publicRead = await request(publicStorage.publicObjectUrl(publicKey));
    if (Buffer.compare(Buffer.from(await publicRead.arrayBuffer()), payload) !== 0) throw new Error("Public custom-domain readback mismatch");

    await privateStorage.uploadObject(privateKey, payload, { contentType: "text/plain", cacheControl: "private, no-store" });
    const privateHead = await privateStorage.headObject(privateKey);
    if (privateHead.contentLength != null && privateHead.contentLength !== payload.length) throw new Error("Private bucket HEAD size mismatch (expected " + payload.length + ", got " + privateHead.contentLength + ")");
    const privateRead = await request(privateStorage.signedReadUrl(privateKey, 180));
    if (Buffer.compare(Buffer.from(await privateRead.arrayBuffer()), payload) !== 0) throw new Error("Private signed-URL readback mismatch");

    // The public media hostname must not expose the private-bucket key.
    const privateLeak = await fetch(publicBase + "/" + encodeURIComponent(privateKey));
    if (privateLeak.ok) throw new Error("Private smoke object unexpectedly accessible through public media hostname");

    process.stdout.write(JSON.stringify({
      status: "SUCCESS",
      public_bucket: "write/head/custom-domain-read verified",
      private_bucket: "write/head/signed-read verified",
      private_public_access: "denied",
      bytes_verified: payload.length,
    }, null, 2) + "\n");
  } finally {
    const publicDelete = await fetch(publicStorage.presign("DELETE", publicKey, 60), { method: "DELETE" }).catch(() => null);
    publicDeleted = Boolean(publicDelete && (publicDelete.ok || publicDelete.status === 404));
    const privateDelete = await fetch(privateStorage.presign("DELETE", privateKey, 60), { method: "DELETE" }).catch(() => null);
    privateDeleted = Boolean(privateDelete && (privateDelete.ok || privateDelete.status === 404));
    if (!publicDeleted || !privateDeleted) throw new Error("Smoke-test cleanup failed; check __guli_r2_smoke__ objects manually");
  }
}
main().catch((error) => {
  process.stderr.write("R2_LIVE_SMOKE_FAILED: " + error.message + "\n");
  process.exitCode = 1;
});
