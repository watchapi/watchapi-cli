#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { checkCommand } from "./commands/check.js";
import { analyzeCommand } from "./commands/analyze.js";

// Load .env file
config();

const program = new Command();

program
  .name("watchapi")
  .description(
    "CLI tool for API monitoring and regression detection in CI/CD pipelines",
  )
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze tRPC routers for consistency and safety")
  .option("-t, --target <target>", "Adapter target", "trpc")
  .option("--root <path>", "Project root to scan", process.cwd())
  .option("--tsconfig <path>", "Path to tsconfig", "tsconfig.json")
  .option("--include <globs...>", "Glob(s) for router files")
  .option("--format <format>", "Output format: table | json", "table")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option(
    "--router-factory <names...>",
    "Router factory identifiers to detect (comma separated or repeat flag)",
  )
  .option(
    "--router-identifier-pattern <regex>",
    "Regex to detect router identifiers (default: /router$/i)",
  )
  .action(async (options) => {
    await analyzeCommand({
      target: options.target,
      root: options.root,
      tsconfig: options.tsconfig,
      include: options.include,
      format: options.format,
      verbose: options.verbose,
      routerFactory: options.routerFactory,
      routerIdentifierPattern: options.routerIdentifierPattern,
    });
  });

program
  .command("check")
  .description("Run API checks for a collection")
  .requiredOption("-c, --collection <id>", "Collection ID to check")
  .option(
    "-e, --env <environment>",
    "Environment name (e.g., production, staging)",
    "production",
  )
  .option(
    "--api-url <url>",
    "API platform URL",
    process.env.WATCHAPI_URL || "https://api-monitoring.example.com",
  )
  .option(
    "--api-token <token>",
    "API authentication token",
    process.env.WATCHAPI_TOKEN || "",
  )
  .option(
    "--fail-on <mode>",
    "When to fail the CI/CD pipeline (any|regressions)",
    "regressions",
  )
  .action(async (options) => {
    if (!options.apiToken) {
      console.error(
        "Error: API token is required. Set WATCHAPI_TOKEN env var or use --api-token",
      );
      process.exit(1);
    }

    await checkCommand({
      collection: options.collection,
      env: options.env,
      apiUrl: options.apiUrl,
      apiToken: options.apiToken,
      failOn: options.failOn as "any" | "regressions",
    });
  });

program.parse();
