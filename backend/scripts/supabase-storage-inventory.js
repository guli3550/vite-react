#!/usr/bin/env node
"use strict";

// Read-only inventory: lists Supabase Storage bucket metadata only.
// Does not list object paths, download files, upload files, or mutate storage.
const { createClient } = require("@supabase/supabase-js");

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

async function main() {
  const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error("Supabase Storage bucket inventory failed: " + error.message);

  const buckets = (data || []).map((bucket) => ({
    name: bucket.name,
    id: bucket.id || null,
    public: Boolean(bucket.public),
    file_size_limit: bucket.file_size_limit ?? null,
    allowed_mime_types: bucket.allowed_mime_types ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const report = {
    generated_at: new Date().toISOString(),
    project_url: required("SUPABASE_URL"),
    mode: "READ_ONLY_BUCKET_INVENTORY",
    bucket_count: buckets.length,
    buckets,
    safety: {
      objects_listed: false,
      files_downloaded: false,
      files_uploaded: false,
      source_data_modified: false,
    },
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      "# GULI MARKET — Supabase Storage bucket inventory",
      "",
      "- Generated: " + report.generated_at,
      "- Buckets: " + report.bucket_count,
      "- Mode: read-only; no object listing or file transfer",
      "",
      "| Bucket | Public | File size limit |",
      "|---|---:|---:|",
      ...buckets.map((b) => "| " + b.name + " | " + b.public + " | " + (b.file_size_limit ?? "not set") + " |"),
      "",
      "No Storage objects were listed, downloaded, uploaded, or modified.",
    ];
    require("node:fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\\n") + "\\n");
  }
}

main().catch((error) => {
  process.stderr.write("INVENTORY_FAILED: " + error.message + "\\n");
  process.exitCode = 1;
});
