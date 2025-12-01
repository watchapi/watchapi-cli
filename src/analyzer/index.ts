import path from "node:path";

import { analyzeTrpc } from "./trpc/analyzer.js";
import { printReport } from "./reporters.js";
import type { AnalyzerOptions, AnalyzerResult } from "./types.js";

export async function runAnalyzer(
  options: AnalyzerOptions,
): Promise<AnalyzerResult> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());

  if (options.target !== "trpc") {
    throw new Error(`Unsupported target: ${options.target}`);
  }

  return analyzeTrpc({ ...options, rootDir });
}

export { printReport };
export * from "./types.js";
