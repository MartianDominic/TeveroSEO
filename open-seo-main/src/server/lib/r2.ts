import { promises as fs } from "node:fs";
import path from "node:path";

const STORAGE_ROOT = path.resolve(process.cwd(), ".data", "audit-cache");

function safeKeyToPath(key: string): string {
  // R2 keys are opaque strings. Replace path separators and nulls to
  // guarantee we never escape STORAGE_ROOT.
  let safe = key.replace(/[\0]/g, "_");

  // Recursively remove path traversal sequences (handles ....// -> ../ cases)
  let prev = "";
  while (prev !== safe) {
    prev = safe;
    safe = safe.replace(/\.\.\//g, "_").replace(/\.\.\\/g, "_");
  }

  // Replace remaining path separators
  safe = safe.replace(/[/\\]/g, "__");

  // Final validation: resolve and check it stays within STORAGE_ROOT
  const resolved = path.resolve(STORAGE_ROOT, safe);
  if (!resolved.startsWith(path.resolve(STORAGE_ROOT))) {
    throw new Error("Path traversal detected");
  }

  return resolved;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

export async function getJsonFromR2(key: string): Promise<string> {
  const filePath = safeKeyToPath(key);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Audit payload not found");
    }
    throw err;
  }
}

export async function putTextToR2(
  key: string,
  body: string,
): Promise<{ key: string; sizeBytes: number }> {
  await ensureDir();
  const filePath = safeKeyToPath(key);
  await fs.writeFile(filePath, body, "utf8");
  return { key, sizeBytes: Buffer.byteLength(body) };
}
