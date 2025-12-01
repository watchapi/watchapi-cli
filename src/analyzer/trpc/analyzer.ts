import path from "node:path";

import {
  ArrowFunction,
  CallExpression,
  FunctionExpression,
  Node,
  Project,
  PropertyAssignment,
  ShorthandPropertyAssignment,
  SourceFile,
  SyntaxKind,
} from "ts-morph";

import { buildSummary, applyRules } from "../utils/rules.js";
import type {
  AnalyzerOptions,
  AnalyzerResult,
  ProcedureVisibility,
  RuleContext,
  TrpcProcedureNode,
  TrpcRouterMeta,
} from "../types.js";
import {
  DEFAULT_TRPC_INCLUDE,
  SIDE_EFFECT_PATTERNS,
} from "./constants.js";
import {
  buildRouterDetectionConfig,
  collectRouterCallSites,
  isRouterReference,
} from "./detection.js";
import { trpcRouterRules, trpcRules } from "./rules.js";

export async function analyzeTrpc(
  options: AnalyzerOptions,
): Promise<AnalyzerResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const tsconfig = path.resolve(rootDir, options.tsconfigPath ?? "tsconfig.json");
  const debug = createDebugLogger(options.verbose);

  const project = new Project({
    tsConfigFilePath: tsconfig,
    skipAddingFilesFromTsConfig: false,
  });

  debug(`Using tsconfig at ${tsconfig}`);

  const includeGlobs = options.include?.length
    ? options.include
    : DEFAULT_TRPC_INCLUDE;

  debug(`Include patterns: ${includeGlobs.join(", ")}`);
  for (const pattern of includeGlobs) {
    project.addSourceFilesAtPaths(path.resolve(rootDir, pattern));
  }

  const sourceFiles = project
    .getSourceFiles()
    .filter((file) => file.getFilePath().startsWith(rootDir));

  debug(`Found ${sourceFiles.length} source file(s) under root ${rootDir}`);

  const nodes: TrpcProcedureNode[] = [];
  const routers: TrpcRouterMeta[] = [];
  const detection = buildRouterDetectionConfig(options, debug);

  for (const file of sourceFiles) {
    debug(`Scanning file ${path.relative(rootDir, file.getFilePath())}`);
    const { nodes: fileNodes, routers: fileRouters } =
      extractProceduresFromFile(file, rootDir, detection, debug);
    nodes.push(...fileNodes);
    routers.push(...fileRouters);
  }

  const ctx: RuleContext = { rootDir, project, routerMeta: routers };
  const issues = applyRules(nodes, routers, ctx, trpcRules, trpcRouterRules);

  return {
    issues,
    summary: buildSummary(issues),
    nodes,
  };
}

function extractProceduresFromFile(
  sourceFile: SourceFile,
  rootDir: string,
  detection: ReturnType<typeof buildRouterDetectionConfig>,
  debug: DebugLogger,
) {
  const nodes: TrpcProcedureNode[] = [];
  const routers: TrpcRouterMeta[] = [];

  const routerCalls = collectRouterCallSites(sourceFile, detection, debug);

  routerCalls.forEach(({ call, name }) => {
    const router = parseRouter(call, name, rootDir, detection, debug);
    if (!router) return;

    debug(
      `Found router '${router.routerMeta.name}' in ${router.routerMeta.file} with ${router.nodes.length} procedure(s)`,
    );
    nodes.push(...router.nodes);
    routers.push(router.routerMeta);
  });

  if (!routerCalls.length) {
    debug(
      `No tRPC router found in ${path.relative(rootDir, sourceFile.getFilePath())}`,
    );
  }

  return { nodes, routers };
}

function parseRouter(
  initializer: CallExpression,
  routerName: string,
  rootDir: string,
  detection: ReturnType<typeof buildRouterDetectionConfig>,
  debug: DebugLogger,
) {
  const routesArg = initializer.getArguments()[0];
  if (!routesArg || !Node.isObjectLiteralExpression(routesArg)) return null;

  const routerMeta: TrpcRouterMeta = {
    name: routerName,
    file: path.relative(rootDir, initializer.getSourceFile().getFilePath()),
    line: initializer.getStartLineNumber(),
    linesOfCode:
      initializer.getEndLineNumber() - initializer.getStartLineNumber() + 1,
  };

  const nodes: TrpcProcedureNode[] = [];

  for (const property of routesArg.getProperties()) {
    if (
      !Node.isPropertyAssignment(property) &&
      !Node.isShorthandPropertyAssignment(property)
    ) {
      continue;
    }

    const nameNode = property.getNameNode();
    const procedureName = nameNode.getText().replace(/["']/g, "");
    const initializerNode = getInitializerFromProperty(property);
    if (!initializerNode) continue;

    if (isRouterReference(initializerNode, detection)) {
      debug(
        `Property '${procedureName}' in router '${routerName}' looks like a nested router; skipping composition`,
      );
      continue;
    }

    const procedureNode = parseProcedure(
      initializerNode,
      procedureName,
      routerName,
      rootDir,
      nameNode.getStartLineNumber(),
      debug,
    );

    if (procedureNode) {
      nodes.push(procedureNode);
      debug(
        `Captured procedure '${procedureName}' (${procedureNode.method}) in router '${routerName}' at line ${procedureNode.line}`,
      );
    } else {
      debug(
        `Skipping property '${procedureName}' in router '${routerName}' (not a tRPC procedure)`,
      );
    }
  }

  return { nodes, routerMeta };
}

function getInitializerFromProperty(
  property: PropertyAssignment | ShorthandPropertyAssignment,
) {
  if (Node.isPropertyAssignment(property)) return property.getInitializer();
  if (Node.isShorthandPropertyAssignment(property))
    return property.getObjectAssignmentInitializer();
  return undefined;
}

function parseProcedure(
  expression: Node,
  procedureName: string,
  routerName: string,
  rootDir: string,
  line: number,
  debug: DebugLogger,
): TrpcProcedureNode | null {
  let method: TrpcProcedureNode["method"] | null = null;
  let input = false;
  let output = false;
  let procedureType: ProcedureVisibility = "unknown";
  let resolver: ArrowFunction | FunctionExpression | undefined;

  const walkExpression = (target: Node | undefined): void => {
    if (!target) return;

    if (Node.isCallExpression(target)) {
      const targetExpression = target.getExpression();

      if (Node.isPropertyAccessExpression(targetExpression)) {
        const propertyName = targetExpression.getName();

        if (propertyName === "input") input = true;
        if (propertyName === "output") output = true;

        if (propertyName === "mutation" || propertyName === "query") {
          method = propertyName;
          const handler = target.getArguments()[0];
          if (Node.isArrowFunction(handler) || Node.isFunctionExpression(handler)) {
            resolver = handler;
          }
        }

        const base = targetExpression.getExpression();
        if (Node.isIdentifier(base)) {
          procedureType = mapProcedureType(base.getText(), procedureType);
        }

        walkExpression(base);
        return;
      }

      if (Node.isIdentifier(targetExpression)) {
        procedureType = mapProcedureType(targetExpression.getText(), procedureType);
      }

      target.getChildren().forEach((child) => walkExpression(child));
    }
  };

  walkExpression(expression);

  if (!method) {
    debug(
      `Expression for '${procedureName}' in router '${routerName}' is not a query/mutation; skipping`,
    );
    return null;
  }

  const resolverAnalysis = analyzeResolver(resolver);

  return {
    router: routerName,
    procedure: procedureName,
    method,
    input,
    output,
    file: path.relative(rootDir, expression.getSourceFile().getFilePath()),
    line,
    procedureType,
    ...resolverAnalysis,
  };
}

function mapProcedureType(
  identifier: string,
  fallback: ProcedureVisibility,
): ProcedureVisibility {
  if (identifier === "publicProcedure") return "public";
  if (identifier === "privateProcedure") return "private";
  if (identifier === "protectedProcedure") return "protected";
  if (identifier === "adminProcedure") return "admin";
  return fallback;
}

function analyzeResolver(resolver?: ArrowFunction | FunctionExpression) {
  if (!resolver) {
    return {
      resolverLines: 0,
      usesDb: false,
      hasErrorHandling: false,
      hasSideEffects: false,
    };
  }

  const body = resolver.getBody();
  const resolverText = body.getText();
  const resolverLines =
    resolver.getEndLineNumber() - resolver.getStartLineNumber() + 1;

  const usesDb = /\b(db\.|prisma\.)/.test(resolverText);
  const hasErrorHandling =
    resolverText.includes("TRPCError") ||
    body.getDescendantsOfKind(SyntaxKind.TryStatement).length > 0 ||
    body.getDescendantsOfKind(SyntaxKind.ThrowStatement).some((throwStmt) =>
      throwStmt.getExpression()?.getText().includes("TRPCError"),
    );

  const hasSideEffects = SIDE_EFFECT_PATTERNS.test(resolverText);

  return { resolverLines, usesDb, hasErrorHandling, hasSideEffects };
}

type DebugLogger = (message: string) => void;

function createDebugLogger(verbose?: boolean): DebugLogger {
  return (message: string) => {
    if (!verbose) return;
    console.log(`[trpc:debug] ${message}`);
  };
}
