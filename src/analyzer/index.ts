import path from "node:path";

import { analyzeOpenApi } from "./open-api/analyzer.js";
import { analyzeTrpc } from "./trpc/analyzer.js";
import { printReport } from "./reporters.js";
import type { AnalyzerOptions, AnalyzerResult } from "./types.js";

export async function runAnalyzer(
  options: AnalyzerOptions,
): Promise<AnalyzerResult> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());

  if (options.target === "next-trpc") {
    return analyzeTrpc({ ...options, rootDir });
  }

  if (options.target === "nest") {
    return analyzeOpenApi({ ...options, rootDir });
  }

  throw new Error(`Unsupported target: ${options.target}`);
}

export { printReport };
export * from "./types.js";
