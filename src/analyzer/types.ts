import type { Project } from "ts-morph";

export type AnalyzerTarget = "trpc";

export type Severity = "info" | "warn" | "error";

export interface AnalyzerIssue {
  severity: Severity;
  message: string;
  file: string;
  line: number;
  router: string;
  procedure: string;
  rule: string;
}

export interface AnalyzerSummary {
  info: number;
  warn: number;
  error: number;
}

export interface AnalyzerResult {
  issues: AnalyzerIssue[];
  summary: AnalyzerSummary;
  nodes: TrpcProcedureNode[];
}

export interface AnalyzerOptions {
  rootDir: string;
  target: AnalyzerTarget;
  tsconfigPath?: string;
  include?: string[];
  format?: "table" | "json";
  verbose?: boolean;
  routerFactories?: string[];
  routerIdentifierPattern?: string;
}

export type ProcedureVisibility =
  | "public"
  | "private"
  | "protected"
  | "admin"
  | "unknown";

export interface TrpcProcedureNode {
  router: string;
  procedure: string;
  method: "query" | "mutation";
  input: boolean;
  output: boolean;
  file: string;
  line: number;
  procedureType: ProcedureVisibility;
  resolverLines: number;
  usesDb: boolean;
  hasErrorHandling: boolean;
  hasSideEffects: boolean;
}

export interface TrpcRouterMeta {
  name: string;
  file: string;
  line: number;
  linesOfCode: number;
}

export interface RuleContext {
  rootDir: string;
  project: Project;
  routerMeta: TrpcRouterMeta[];
}

export type RuleRunner = (
  node: TrpcProcedureNode,
  ctx: RuleContext,
) => AnalyzerIssue | AnalyzerIssue[] | null | undefined;

export type RouterRuleRunner = (
  router: TrpcRouterMeta,
  ctx: RuleContext,
) => AnalyzerIssue | AnalyzerIssue[] | null | undefined;
