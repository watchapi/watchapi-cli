import path from "node:path";

import chalk from "chalk";
import ora from "ora";

import {
  printReport,
  runAnalyzer,
  type AnalyzerOptions,
  type AnalyzerTarget,
} from "../analyzer/index.js";

export interface AnalyzeCommandOptions {
  target?: AnalyzerTarget;
  root?: string;
  tsconfig?: string;
  include?: string[];
  format?: AnalyzerOptions["format"];
  verbose?: boolean;
  routerFactory?: string[];
  routerIdentifierPattern?: string;
}

export async function analyzeCommand(
  options: AnalyzeCommandOptions,
): Promise<void> {
  const rootDir = path.resolve(options.root ?? process.cwd());
  const target: AnalyzerTarget = options.target ?? "trpc";
  const format: NonNullable<AnalyzerOptions["format"]> =
    options.format === "json" ? "json" : "table";
  const spinner = options.verbose ? null : ora("Analyzing tRPC procedures...").start();

  try {
    const result = await runAnalyzer({
      rootDir,
      target,
      tsconfigPath: options.tsconfig,
      include: options.include,
      format,
      verbose: options.verbose,
      routerFactories: options.routerFactory,
      routerIdentifierPattern: options.routerIdentifierPattern,
    });

    const finishedMsg = `Finished analysis with ${result.issues.length} finding${
      result.issues.length === 1 ? "" : "s"
    }`;

    if (spinner) {
      spinner.succeed(finishedMsg);
    } else {
      console.log(finishedMsg);
    }

    printReport(result, format);
    process.exit(result.summary.error > 0 ? 1 : 0);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown analyzer failure";

    if (spinner) {
      spinner.fail(chalk.red(message));
    } else {
      console.error(chalk.red(message));
    }

    process.exit(1);
  }
}
