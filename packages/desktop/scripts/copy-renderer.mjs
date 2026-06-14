// Copies static renderer assets (HTML) into dist after tsc compiles the TS.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src/renderer/index.html");
const destDir = resolve(here, "../dist/renderer");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, resolve(destDir, "index.html"));
console.log("Copied renderer/index.html -> dist/renderer/");
