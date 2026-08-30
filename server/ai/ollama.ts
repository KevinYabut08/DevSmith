import axios from "axios";

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_URL || "http://localhost:11434";

const OLLAMA_URL = OLLAMA_BASE_URL;

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest?: string;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * Get models installed in Ollama.
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
  const response = await axios.get<OllamaTagsResponse>(
    `${OLLAMA_URL}/api/tags`,
    {
      timeout: 5000,
    }
  );

  return response.data.models ?? [];
}

/**
 * Check whether Ollama is running.
 */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    await axios.get(`${OLLAMA_URL}/api/tags`, {
      timeout: 2000,
    });

    return true;
  } catch {
    return false;
  }
}

interface GenerateOptions {
  format?: "json";
  timeout?: number;
}

/**
 * Send a prompt to an Ollama model and return the text response.
 */
export async function generateWithOllama(
  model: string,
  prompt: string,
  options?: GenerateOptions
): Promise<string> {
  const selectedModel = model.trim();

  if (!selectedModel) {
    throw new Error("Ollama model is required.");
  }

  try {
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: selectedModel,
        prompt,
        stream: false,
        ...(options?.format ? { format: options.format } : {}),
      },
      {
        timeout: options?.timeout ?? 120000,
      }
    );

    const raw = response.data?.response;

    if (!raw) {
      throw new Error("Ollama returned an empty response.");
    }

    return raw;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (
        error.response?.status === 404 &&
        error.response?.data?.error?.includes("model")
      ) {
        throw new Error(
          `Ollama model "${selectedModel}" is not installed. ` +
            `Run "ollama pull ${selectedModel}" or select an installed model.`
        );
      }

      if (error.code === "ECONNREFUSED") {
        throw new Error(
          "Could not connect to Ollama. Make sure Ollama is running."
        );
      }

      throw new Error(
        `Ollama request failed with status ${
          error.response?.status ?? "unknown"
        }.`
      );
    }

    throw error;
  }
}