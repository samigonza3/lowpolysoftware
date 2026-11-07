import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Cerebro del agente. Dos backends:
 *  - "api": Claude API con ANTHROPIC_API_KEY (salida estructurada con JSON Schema).
 *  - "cli": Claude Code instalado en el equipo (`claude -p --json-schema`), usa tu sesión
 *    de Claude Code sin API key — igual que los editores que "conectan tu agente".
 */
export const MODEL = process.env.LLM_MODEL || "claude-opus-5-5";

export function llmBackend(): "api" | "cli" | "none" {
  if (process.env.LLM_BACKEND === "api" || process.env.ANTHROPIC_API_KEY) return "api";
  return claudeBin() ? "cli" : "none";
}

function claudeBin(): string | null {
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const candidates = [
    path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"),
    path.join(os.homedir(), ".local", "bin", "claude.exe"),
    path.join(os.homedir(), ".local", "bin", "claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  return candidates.find((c) => c && fs.existsSync(c)) ?? null;
}

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export interface ImageInput {
  data: string; // base64
  mediaType: "image/jpeg" | "image/png";
}

let client: Anthropic | null = null;

function userContent(prompt: string, images?: ImageInput[]) {
  if (!images?.length) return prompt;
  return [
    ...images.map((im) => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.mediaType, data: im.data } })),
    { type: "text" as const, text: prompt },
  ];
}

export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  effort?: "low" | "medium" | "high";
  images?: ImageInput[];
}): Promise<T> {
  const backend = llmBackend();
  const schemaJson = jsonSchemaOf(opts.schema);
  let raw: unknown;
  if (backend === "api") {
    client ??= new Anthropic();
    // fallbacks "default": si un clasificador de seguridad rechaza por error, el servidor
    // reintenta con el modelo de respaldo adecuado dentro de la misma llamada.
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: [{ role: "user", content: userContent(opts.prompt, opts.images) }],
      output_config: { effort: opts.effort ?? "medium", format: { type: "json_schema", schema: schemaJson } },
    } as Parameters<typeof client.beta.messages.stream>[0]);
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("El modelo rechazó la solicitud.");
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    raw = JSON.parse(text);
  } else if (backend === "cli") {
    raw = await runClaudeCli(opts.system, opts.prompt, schemaJson, opts.images);
  } else {
    throw new Error(
      "No hay agente disponible: instala Claude Code (y haz login) o define ANTHROPIC_API_KEY en el archivo .env",
    );
  }
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    console.error("[llm] respuesta inválida", parsed.error.issues.slice(0, 5));
    throw new Error("El agente devolvió un formato inesperado, intenta de nuevo.");
  }
  return parsed.data;
}

function runClaudeCli(system: string, prompt: string, schema: Record<string, unknown>, images?: ImageInput[]): Promise<unknown> {
  const bin = claudeBin()!;
  // Con imágenes el mensaje va como stream-json (bloques de imagen en base64); sin imágenes, texto plano.
  const streaming = Boolean(images?.length);
  const args = [
    "-p",
    ...(streaming ? ["--input-format", "stream-json", "--output-format", "stream-json", "--verbose"] : ["--output-format", "json"]),
    "--no-session-persistence",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--tools", "",
    "--model", MODEL,
    "--system-prompt", system,
    "--json-schema", JSON.stringify(schema),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: os.tmpdir(), windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("El agente tardó demasiado (timeout 6 min)."));
    }, 6 * 60_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(
          streaming ? out.split(/\r?\n/).filter((l) => l.includes('"type":"result"')).pop() ?? "" : out,
        );
        if (j.is_error) return reject(new Error(`Claude Code: ${j.result ?? j.subtype ?? "error"}`));
        if (j.structured_output !== undefined) return resolve(j.structured_output);
        return resolve(JSON.parse(String(j.result ?? "").replace(/^```(json)?|```$/g, "")));
      } catch {
        reject(new Error(`No se pudo leer la respuesta de Claude Code. ${err.slice(0, 300) || out.slice(0, 300)}`));
      }
    });
    child.stdin.end(
      streaming
        ? JSON.stringify({ type: "user", message: { role: "user", content: userContent(prompt, images) } }) + "\n"
        : prompt,
    );
  });
}
