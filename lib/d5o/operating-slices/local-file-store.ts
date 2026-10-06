import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OperatingSliceStoreEnvelope } from "./types";

type EmptyStoreInput = {
  recoveredFromCorruptStore?: boolean;
  schemaVersionMismatch?: boolean;
};

type LocalStoreOptions<TStore extends OperatingSliceStoreEnvelope> = {
  path: string;
  schemaVersion: number;
  createEmptyStore: (input: EmptyStoreInput) => TStore;
  normalizeStore: (store: Partial<TStore>) => TStore;
};

export function operatingSliceNow() {
  return new Date().toISOString();
}

export function resolveOperatingSliceStorePath(envVarName: string, fileName: string) {
  return process.env[envVarName] ?? join(".rybexos-local", fileName);
}

export async function readLocalOperatingSliceStore<TStore extends OperatingSliceStoreEnvelope>(
  options: LocalStoreOptions<TStore>
): Promise<TStore> {
  try {
    const parsed = safeJsonParse(await readFile(options.path, "utf8"));
    const version = typeof parsed.version === "number" ? parsed.version : undefined;

    if (version !== options.schemaVersion) {
      return options.createEmptyStore({ schemaVersionMismatch: true });
    }

    return options.normalizeStore(parsed as Partial<TStore>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return options.createEmptyStore({});
    }

    if (error instanceof SyntaxError) {
      return options.createEmptyStore({ recoveredFromCorruptStore: true });
    }

    throw error;
  }
}

export async function writeLocalOperatingSliceStore<TStore extends OperatingSliceStoreEnvelope>(
  store: TStore,
  options: Pick<LocalStoreOptions<TStore>, "path" | "normalizeStore">
) {
  const filePath = options.path;
  await mkdir(dirname(filePath), { recursive: true });
  const normalized = options.normalizeStore(store);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tmpPath, `${safeJsonStringify(normalized)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

export async function resetLocalOperatingSliceStore<TStore extends OperatingSliceStoreEnvelope>(
  store: TStore,
  options: Pick<LocalStoreOptions<TStore>, "path" | "normalizeStore">
) {
  await writeLocalOperatingSliceStore(store, options);
  return options.normalizeStore(store);
}

function safeJsonParse(text: string) {
  return JSON.parse(text) as Record<string, unknown>;
}

function safeJsonStringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}
