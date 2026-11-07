// Descarga los modelos de voz (sherpa-onnx) a ./models
// Uso: npm run setup:voices            -> Kokoro multilingüe (obligatorio, ~350 MB)
//      npm run setup:voices -- --latam -> además las voces Piper latinas (~60 MB c/u)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "models");
fs.mkdirSync(dir, { recursive: true });

const models = ["kokoro-multi-lang-v1_0"];
if (process.argv.includes("--latam")) {
  models.push("vits-piper-es_MX-claude-high", "vits-piper-es_AR-daniela-high", "vits-piper-es_MX-ald-medium", "vits-piper-es_ES-davefx-medium");
}

for (const m of models) {
  if (fs.existsSync(path.join(dir, m))) {
    console.log(`✓ ${m} ya está instalado`);
    continue;
  }
  const url = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${m}.tar.bz2`;
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  falló (${res.status})`);
    process.exitCode = 1;
    continue;
  }
  const tmp = path.join(dir, `${m}.tar.bz2`);
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  const r = spawnSync("tar", ["-xjf", tmp, "-C", dir], { stdio: "inherit" });
  fs.rmSync(tmp, { force: true });
  console.log(r.status === 0 ? `✓ ${m}` : `✗ no se pudo descomprimir ${m}`);
}
