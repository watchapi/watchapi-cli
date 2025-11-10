#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { checkCommand } from "./commands/check.js";

// Load .env file
config();

const program = new Command();

program
  .name("watchapi")
  .description("CLI tool for API monitoring and regression detection in CI/CD pipelines")
  .version("0.1.0");

program
  .command("check")
  .description("Run API checks for a collection")
  .requiredOption("-c, --collection <id>", "Collection ID to check")
  .option("-e, --env <environment>", "Environment name (e.g., production, staging)", "production")
  .option(
    "--api-url <url>",
    "API platform URL",
    process.env.WATCHAPI_URL || "https://api-monitoring.example.com"
  )
  .option(
    "--api-token <token>",
    "API authentication token",
    process.env.WATCHAPI_TOKEN || ""
  )
  .option(
    "--fail-on <mode>",
    "When to fail the CI/CD pipeline (any|regressions)",
    "regressions"
  )
  .action(async (options) => {
    if (!options.apiToken) {
      console.error("Error: API token is required. Set WATCHAPI_TOKEN env var or use --api-token");
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
