import fs from "node:fs/promises";
import { TwaManifest, TwaGenerator, ConsoleLog } from "@bubblewrap/core";

const projectDir = "twa-android";
const raw = JSON.parse(await fs.readFile("twa-manifest.json", "utf8"));
const manifest = new TwaManifest(raw);

const error = manifest.validate();
if (error) throw new Error("Invalid TWA manifest: " + error);

await fs.rm(projectDir, { recursive: true, force: true });
await fs.mkdir(projectDir, { recursive: true });

const generator = new TwaGenerator();
await generator.createTwaProject(
  projectDir,
  manifest,
  new ConsoleLog("GULI TWA")
);

console.log("GULI TWA Android project generated:", projectDir);
