import fs from "node:fs/promises";
import crypto from "node:crypto";
import { TwaManifest, TwaGenerator, ConsoleLog } from "@bubblewrap/core";

const projectDir = "twa-android";
const manifestFile = "twa-manifest.json";
const raw = JSON.parse(await fs.readFile(manifestFile, "utf8"));
const manifest = new TwaManifest(raw);

const error = manifest.validate();
if (error) throw new Error("Invalid TWA manifest: " + error);

await fs.rm(projectDir, { recursive: true, force: true });
await fs.mkdir(projectDir, { recursive: true });

// Bubblewrap CLI build resolves twa-manifest.json relative to the generated
// Android project. Keep the exact source manifest alongside the generated
// project so `bubblewrap build` can validate its checksum and metadata.
await fs.copyFile(manifestFile, `${projectDir}/${manifestFile}`);

const generator = new TwaGenerator();
await generator.createTwaProject(
  projectDir,
  manifest,
  new ConsoleLog("GULI TWA")
);

// @bubblewrap/cli expects this checksum file before bubblewrap build.
// The core TwaGenerator generates the Android project; the CLI init/update
// commands generate the checksum separately.
const manifestContents = await fs.readFile(manifestFile);
const checksum = crypto.createHash("sha1").update(manifestContents).digest("hex");
await fs.writeFile(`${projectDir}/manifest-checksum.txt`, checksum);

console.log("GULI TWA Android project generated:", projectDir);
console.log("GULI TWA manifest checksum generated:", checksum);
