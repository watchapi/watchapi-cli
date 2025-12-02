import path from "node:path";

import chalk from "chalk";
import ora from "ora";

import { ApiClient } from "../api-client.js";
import { DEFAULT_API_URL, loadAuthConfig } from "../auth-config.js";
import { runAnalyzer } from "../analyzer/index.js";
import type { AnalyzerTarget, TrpcProcedureNode } from "../analyzer/types.js";
import type { PushApiDefinition } from "../types.js";

export interface PushCommandOptions {
  target?: AnalyzerTarget;
  root?: string;
  tsconfig?: string;
  include?: string[];
  apiUrl?: string;
  apiToken?: string;
  dryRun?: boolean;
  verbose?: boolean;
  routerFactory?: string[];
  routerIdentifierPattern?: string;
}

export async function pushCommand(options: PushCommandOptions): Promise<void> {
  const target: AnalyzerTarget = options.target ?? "trpc";
  const rootDir = path.resolve(options.root ?? process.cwd());
  const storedAuth = loadAuthConfig();
  const apiUrl =
    options.apiUrl ||
    process.env.NEXT_PUBLIC_DOMAIN ||
    storedAuth?.apiUrl ||
    DEFAULT_API_URL;
  const apiToken =
    options.apiToken || process.env.WATCHAPI_TOKEN || storedAuth?.apiToken;

  if (!apiToken) {
    console.error(
      "Error: API token is required. Set WATCHAPI_TOKEN env var, use --api-token, or run watchapi login",
    );
    process.exit(1);
  }

  const spinner = options.verbose ? null : ora("Discovering APIs...").start();

  try {
    const analysis = await runAnalyzer({
      rootDir,
      target,
      tsconfigPath: options.tsconfig,
      include: options.include,
      format: "json",
      verbose: options.verbose,
      routerFactories: options.routerFactory,
      routerIdentifierPattern: options.routerIdentifierPattern,
    });

    const apis = buildApiDefinitions(target, analysis.nodes);
    const foundMsg = `Found ${apis.length} API${apis.length === 1 ? "" : "s"} from ${target}`;

    if (spinner) {
      spinner.succeed(foundMsg);
    } else {
      console.log(foundMsg);
    }

    if (options.dryRun) {
      console.log(chalk.gray("Dry run enabled - not pushing to platform"));
      console.table(
        apis.map((api) => ({
          id: api.id,
          method: api.method,
          path: api.path ?? `${api.router}.${api.procedure}`,
          file: api.file,
        })),
      );
      return;
    }

    const apiClient = new ApiClient(apiUrl, apiToken);
    if (spinner) {
      spinner.start("Pushing APIs to monitoring platform...");
    } else {
      console.log("Pushing APIs to monitoring platform...");
    }

    const result = await apiClient.pushApis({
      target,
      apis,
      metadata: { rootDir },
    });

    const pushMsg = `Push completed (created: ${result.created ?? 0}, updated: ${result.updated ?? 0}, skipped: ${result.skipped ?? 0})`;

    if (spinner) {
      spinner.succeed(pushMsg);
    } else {
      console.log(pushMsg);
    }

    if (result.message) {
      console.log(result.message);
    }
  } catch (error) {
    if (spinner) {
      spinner.fail("Push failed");
    }

    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  }
}

function buildApiDefinitions(
  target: AnalyzerTarget,
  nodes: TrpcProcedureNode[],
): PushApiDefinition[] {
  if (target === "trpc") {
    return buildTrpcApiDefinitions(nodes);
  }

  throw new Error(`Unsupported push target: ${target}`);
}

function buildTrpcApiDefinitions(
  nodes: TrpcProcedureNode[],
): PushApiDefinition[] {
  return nodes.map((node) => {
    const operationId = `${node.router}.${node.procedure}`;
    return {
      id: operationId,
      name: operationId,
      method: node.method === "query" ? "GET" : "POST",
      router: node.router,
      procedure: node.procedure,
      path: operationId,
      visibility: node.procedureType,
      file: node.file,
      line: node.line,
      metadata: {
        resolverLines: node.resolverLines,
        usesDb: node.usesDb,
        hasErrorHandling: node.hasErrorHandling,
        hasSideEffects: node.hasSideEffects,
      },
    };
  });
}
