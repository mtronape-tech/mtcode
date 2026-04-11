/**
 * prepare-ollama.mjs
 * Downloads OllamaSetup.exe and the Qwen model GGUF into ollama-resources/
 * before the Tauri bundle step. Files are skipped if already present.
 *
 * Run: node scripts/prepare-ollama.mjs
 */

import { createWriteStream, existsSync, mkdirSync, statSync } from "fs";
import { pipeline } from "stream/promises";
import { get as httpsGet } from "https";
import { get as httpGet } from "http";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = path.join(ROOT, "ollama-resources");

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const STUBS_ONLY = process.argv.includes("--stubs");

const FILES = [
  {
    name: "OllamaSetup.exe",
    url:  "https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe",
    minSize: 50 * 1024 * 1024, // 50 MB sanity check
  },
  {
    name: "model.gguf",
    url:  "https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
    minSize: 800 * 1024 * 1024, // 800 MB sanity check
  },
];

function fetchFollow(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? httpsGet : httpGet;
    const req = lib(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        fetchFollow(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      let lastPct = -1;
      res.on("data", (chunk) => {
        received += chunk.length;
        if (total) {
          const pct = Math.floor(received / total * 100);
          if (pct !== lastPct && pct % 5 === 0) {
            process.stdout.write(`\r  ${pct}%  (${(received/1024/1024).toFixed(0)} / ${(total/1024/1024).toFixed(0)} MB)   `);
            lastPct = pct;
          }
        }
      });
      pipeline(res, createWriteStream(dest)).then(resolve).catch(reject);
    });
    req.on("error", reject);
  });
}

for (const { name, url, minSize } of FILES) {
  const dest = path.join(OUT, name);

  if (STUBS_ONLY) {
    // Dev mode: create a 1-byte placeholder so Tauri bundle validation passes
    if (!existsSync(dest)) {
      import("fs").then(({ writeFileSync }) => writeFileSync(dest, Buffer.alloc(1)));
      console.log(`  stub created: ${name}`);
    } else {
      console.log(`  stub exists:  ${name}`);
    }
    continue;
  }

  if (existsSync(dest) && statSync(dest).size >= minSize) {
    console.log(`✓ ${name} already present (${(statSync(dest).size / 1024 / 1024).toFixed(0)} MB)`);
    continue;
  }

  console.log(`↓ Downloading ${name}…`);
  console.log(`  from: ${url}`);
  try {
    await fetchFollow(url, dest);
    process.stdout.write("\n");
    console.log(`✓ ${name} saved (${(statSync(dest).size / 1024 / 1024).toFixed(0)} MB)`);
  } catch (err) {
    process.stdout.write("\n");
    console.error(`✗ Failed to download ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log("\nollama-resources ready.");
