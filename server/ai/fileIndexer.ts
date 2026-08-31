import fs from "node:fs/promises";
import path from "node:path";

export interface IndexedFile {
  path: string;
  content: string;
  extension: string;
}

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".expo",
  "coverage",
  ".cache",
  ".turbo",
  ".vite",
  "out",
  "target",
]);

const IGNORED_FILES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".DS_Store",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".sass",
  ".html",
  ".py",
  ".java",
  ".cs",
  ".sql",
  ".md",
  ".yml",
  ".yaml",
]);

const MAX_FILE_SIZE = 500_000;

async function walkDirectory(
  directory: string,
  rootDirectory: string,
  results: IndexedFile[]
): Promise<void> {
  let entries;

  try {
    entries = await fs.readdir(directory, {
      withFileTypes: true,
    });
  } catch (error) {
    console.warn(
      `Could not read directory ${directory}:`,
      error
    );

    return;
  }

  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      IGNORED_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }

    if (
      entry.isFile() &&
      IGNORED_FILES.has(entry.name)
    ) {
      continue;
    }

    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      await walkDirectory(
        fullPath,
        rootDirectory,
        results
      );

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path
      .extname(entry.name)
      .toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      continue;
    }

    try {
      const stat = await fs.stat(fullPath);

      if (stat.size > MAX_FILE_SIZE) {
        console.warn(
          `Skipping large file: ${fullPath}`
        );

        continue;
      }

      const content = await fs.readFile(
        fullPath,
        "utf8"
      );

      const relativePath = path
        .relative(rootDirectory, fullPath)
        .replaceAll("\\", "/");

      results.push({
        path: relativePath,
        content,
        extension,
      });
    } catch (error) {
      console.warn(
        `Could not read file ${fullPath}:`,
        error
      );
    }
  }
}

export async function indexProjectFiles(
  projectDirectory: string
): Promise<IndexedFile[]> {
  const results: IndexedFile[] = [];

  const absolutePath = path.resolve(
    projectDirectory
  );

  await walkDirectory(
    absolutePath,
    absolutePath,
    results
  );

  return results.sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

export function formatIndexedFiles(
  files: IndexedFile[],
  maxCharacters = 50_000
): string {
  if (!files.length) {
    return "No source files were indexed.";
  }

  let output = "";

  for (const file of files) {
    const language =
      file.extension.replace(".", "") || "text";

    const section = `
FILE: ${file.path}

\`\`\`${language}
${file.content}
\`\`\`

`;

    if (
      output.length + section.length >
      maxCharacters
    ) {
      output += `
[Additional files omitted because the project context limit was reached.]
`;

      break;
    }

    output += section;
  }

  return output.trim();
}