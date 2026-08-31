/**
 * LLM provider abstraction.
 *
 * DevSmith is local-first by design: it talks to Ollama on localhost so
 * your code and prompts never leave your machine. For the hackathon's
 * hosted demo, judges won't have Ollama running, so this wraps the same
 * `generateWithOllama(model, prompt, options)` signature and transparently
 * falls back to a cloud model when Ollama isn't reachable.
 *
 * DROP-IN USAGE:
 *   Everywhere you currently do:
 *     import { generateWithOllama } from "./ollama";
 *   change to:
 *     import { generateWithOllama } from "./llmProvider";
 *   No other code changes needed — same signature, same return type.
 *
 * ENV VARS (set these on your hosting provider, e.g. Render):
 *   OLLAMA_URL          - defaults to http://127.0.0.1:11434 (local dev)
 *   CLOUD_LLM_API_KEY   - API key for the fallback provider
 *   CLOUD_LLM_BASE_URL  - defaults to https://api.openai.com/v1
 *   CLOUD_LLM_MODEL     - defaults to "gpt-4o-mini"
 *
 * If CLOUD_LLM_API_KEY isn't set, this behaves exactly like the original
 * ollama.ts (Ollama-only, will throw if Ollama isn't running) — safe for
 * local dev with zero config changes.
 */

import axios from "axios";
import {
  generateWithOllama as generateWithOllamaOnly,
  isOllamaRunning,
} from "./ollama";

interface GenerateOptions {
  format?: "json";
  timeout?: number;
}

const CLOUD_LLM_API_KEY = process.env.CLOUD_LLM_API_KEY;
const CLOUD_LLM_BASE_URL =
  process.env.CLOUD_LLM_BASE_URL || "https://api.openai.com/v1";
const CLOUD_LLM_MODEL = process.env.CLOUD_LLM_MODEL || "gpt-4o-mini";

async function generateWithCloud(
  prompt: string,
  options?: GenerateOptions
): Promise<string> {
  const response = await axios.post(
    `${CLOUD_LLM_BASE_URL}/chat/completions`,
    {
      model: CLOUD_LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      ...(options?.format === "json"
        ? { response_format: { type: "json_object" } }
        : {}),
    },
    {
      timeout: options?.timeout ?? 60000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUD_LLM_API_KEY}`,
      },
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Cloud model returned an empty response.");
  }

  return content.trim();
}

/**
 * Same signature as the original `generateWithOllama`. Tries Ollama first
 * (so local dev / privacy-preserving use is unaffected); falls back to a
 * cloud model only if Ollama is unreachable and a cloud key is configured.
 */
export async function generateWithOllama(
  model: string,
  prompt: string,
  options?: GenerateOptions
): Promise<string> {
  if (!CLOUD_LLM_API_KEY) {
    // No fallback configured — behave exactly like local-only ollama.ts.
    return generateWithOllamaOnly(model, prompt, options);
  }

  const ollamaUp = await isOllamaRunning();

  if (ollamaUp) {
    return generateWithOllamaOnly(model, prompt, options);
  }

  console.log(
    "[llmProvider] Ollama unreachable — falling back to cloud model:",
    CLOUD_LLM_MODEL
  );

  return generateWithCloud(prompt, options);
}

export { getOllamaModels, isOllamaRunning } from "./ollama";