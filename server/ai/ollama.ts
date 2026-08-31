import axios, {
  AxiosError,
} from "axios";

export const OLLAMA_BASE_URL = (
  process.env.OLLAMA_URL ||
  "http://127.0.0.1:11434"
).replace(/\/+$/, "");

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest?: string;
}

interface OllamaTagsResponse {
  models?: OllamaModel[];
}

interface OllamaGenerateResponse {
  response?: string;
  done?: boolean;
  model?: string;
  created_at?: string;
  error?: string;
}

interface GenerateOptions {
  format?: "json";
  timeout?: number;
}

async function checkConnection(): Promise<void> {
  try {
    await axios.get(
      `${OLLAMA_BASE_URL}/api/tags`,
      {
        timeout: 5000,
      }
    );
  } catch (error) {
    throw createOllamaError(error);
  }
}

export async function getOllamaModels(): Promise<
  OllamaModel[]
> {
  try {
    const response =
      await axios.get<OllamaTagsResponse>(
        `${OLLAMA_BASE_URL}/api/tags`,
        {
          timeout: 5000,
        }
      );

    return response.data.models ?? [];
  } catch (error) {
    throw createOllamaError(error);
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    await axios.get(
      `${OLLAMA_BASE_URL}/api/tags`,
      {
        timeout: 3000,
      }
    );

    return true;
  } catch {
    return false;
  }
}

export async function generateWithOllama(
  model: string,
  prompt: string,
  options?: GenerateOptions
): Promise<string> {
  const selectedModel =
    model?.trim();

  if (!selectedModel) {
    throw new Error(
      "Ollama model is required."
    );
  }

  if (!prompt?.trim()) {
    throw new Error(
      "Prompt is required."
    );
  }

  const timeout =
    options?.timeout ?? 180000;

  console.log(
    "\n────────────────────────────────────"
  );

  console.log("🤖 Ollama request");
  console.log(
    `URL: ${OLLAMA_BASE_URL}`
  );
  console.log(
    `Model: ${selectedModel}`
  );
  console.log(
    `Timeout: ${timeout}ms`
  );

  console.log(
    "────────────────────────────────────"
  );

  try {
    await checkConnection();

    const response =
      await axios.post<OllamaGenerateResponse>(
        `${OLLAMA_BASE_URL}/api/generate`,
        {
          model: selectedModel,
          prompt: prompt.trim(),
          stream: false,

          ...(options?.format
            ? {
                format: options.format,
              }
            : {}),
        },
        {
          timeout,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

    if (response.data?.error) {
      throw new Error(
        response.data.error
      );
    }

    const result =
      response.data?.response;

    if (
      typeof result !== "string" ||
      !result.trim()
    ) {
      throw new Error(
        "Ollama returned an empty response."
      );
    }

    console.log(
      "✅ Ollama response received"
    );

    return result.trim();
  } catch (error) {
    console.error(
      "❌ Ollama request failed"
    );

    if (axios.isAxiosError(error)) {
      console.error({
        message: error.message,
        code: error.code,
        status: error.response?.status,
        response:
          error.response?.data,
        url: error.config?.url,
      });
    } else {
      console.error(error);
    }

    throw createOllamaError(
      error,
      selectedModel
    );
  }
}

function createOllamaError(
  error: unknown,
  model?: string
): Error {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) {
      return error;
    }

    return new Error(
      "Unknown Ollama error."
    );
  }

  const axiosError =
    error as AxiosError<{
      error?: string;
    }>;

  const code =
    axiosError.code;

  const status =
    axiosError.response?.status;

  const responseError =
    axiosError.response?.data?.error;

  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND"
  ) {
    return new Error(
      `Cannot connect to Ollama.

Ollama URL:
${OLLAMA_BASE_URL}

Make sure Ollama is running.

Try:

ollama serve

Then:

ollama list`
    );
  }

  if (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT"
  ) {
    return new Error(
      `Ollama timed out after ${
        axiosError.config?.timeout ??
        "unknown"
      }ms.

The model may be too large or your computer may be under heavy load.

Try a smaller model or increase the timeout.`
    );
  }

  if (status === 404) {
    if (
      responseError
        ?.toLowerCase()
        .includes("model")
    ) {
      return new Error(
        `Ollama model "${model}" was not found.

Run:

ollama list

If necessary:

ollama pull ${model}`
      );
    }

    return new Error(
      `Ollama endpoint was not found.

URL:
${axiosError.config?.url}`
    );
  }

  if (responseError) {
    return new Error(
      `Ollama error: ${responseError}`
    );
  }

  if (status) {
    return new Error(
      `Ollama request failed with HTTP status ${status}.`
    );
  }

  return new Error(
    `Could not communicate with Ollama.

URL:
${OLLAMA_BASE_URL}

Network error:
${axiosError.message}

Error code:
${code ?? "unknown"}`
  );
}