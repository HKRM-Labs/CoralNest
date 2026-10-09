import { ArkErrors, type BaseType, type inferred, type } from "arktype";

export const MCP_SCHEMA_VERSION = 1 as const;
export const MCP_SUMMARY_NAME_MAX_CHARS = 128;
export const MCP_SUMMARY_DESCRIPTION_MAX_CHARS = 1_024;
export const MCP_MANIFEST_FILE_NAMES = ["mcp.json", ".mcp.json"] as const;
export const MCP_PACKAGE_JSON_FIELD = "openclaw.mcp" as const;

const StrictStringArraySchema = type("string[]");
const ToolFilterSchema = type({
  "+": "reject",
  include: StrictStringArraySchema.optional(),
  exclude: StrictStringArraySchema.optional(),
});

export const McpManifestSchema = type({
  "+": "reject",
  schemaVersion: "1",
  name: "string",
  description: "string?",
  transport: '"stdio"|"sse"|"streamable-http"',
  command: "string?",
  args: StrictStringArraySchema.optional(),
  env: type({ "[string]": "string" }).optional(),
  url: "string?",
  headers: type({ "[string]": "string" }).optional(),
  toolFilter: ToolFilterSchema.optional(),
  timeout: "number?",
  connectTimeout: "number?",
});
export type McpManifest = (typeof McpManifestSchema)[inferred];

export type McpManifestSummary = {
  schemaVersion: 1;
  name: string;
  description?: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;
  url?: string;
  argCount: number;
  envCount: number;
  toolCount: number;
};

export type McpManifestSummarySchemaAdapter<TValue, TOptional = TValue> = {
  literalOne: TValue;
  string: TValue;
  number: TValue;
  boundedString: (maxCharacters: number) => TValue;
  optional: (schema: TValue) => TOptional;
  object: (fields: Record<string, TValue | TOptional>) => TValue;
};

/** Builds the v1 summary structure for both the public schema and durable storage validators. */
export function createMcpManifestSummarySchema<TValue, TOptional = TValue>(
  adapter: McpManifestSummarySchemaAdapter<TValue, TOptional>,
): TValue {
  return adapter.object({
    schemaVersion: adapter.literalOne,
    name: adapter.string,
    description: adapter.optional(adapter.boundedString(MCP_SUMMARY_DESCRIPTION_MAX_CHARS)),
    transport: adapter.string,
    command: adapter.optional(adapter.string),
    url: adapter.optional(adapter.string),
    argCount: adapter.number,
    envCount: adapter.number,
    toolCount: adapter.number,
  });
}

export const McpManifestSummarySchema = createMcpManifestSummarySchema<BaseType, [BaseType, "?"]>({
  literalOne: type("1"),
  string: type("string"),
  number: type("number"),
  boundedString: (maxCharacters) =>
    type("string").narrow((value) => Array.from(value).length <= maxCharacters),
  optional: (schema) => schema.optional(),
  object: (fields) => type({ "+": "reject", ...fields }),
}) as BaseType<McpManifestSummary>;

export const MCP_MANIFEST_VALIDATION_PHASE = "schema" as const;
export const MCP_MANIFEST_VALIDATION_CODES = {
  invalidManifestShape: "mcp_v1_invalid_manifest_shape",
  invalidName: "mcp_v1_invalid_name",
  nonCanonicalString: "mcp_v1_non_canonical_string",
  invalidTransport: "mcp_v1_invalid_transport",
  invalidCommand: "mcp_v1_invalid_command",
  invalidMcpUrl: "mcp_v1_invalid_url",
  mcpUrlCredentials: "mcp_v1_url_credentials",
  timeoutsRequiredForRemote: "mcp_v1_timeouts_required_for_remote",
  invalidToolFilter: "mcp_v1_invalid_tool_filter",
  duplicateToolFilter: "mcp_v1_duplicate_tool_filter",
  invalidEnvironmentKey: "mcp_v1_invalid_environment_key",
  blockedEnvironmentKey: "mcp_v1_blocked_environment_key",
  invalidEnvironmentValue: "mcp_v1_invalid_environment_value",
  invalidTimeout: "mcp_v1_invalid_timeout",
} as const;
export type McpManifestValidationCode =
  (typeof MCP_MANIFEST_VALIDATION_CODES)[keyof typeof MCP_MANIFEST_VALIDATION_CODES];
export type McpManifestValidationIssue = {
  code: McpManifestValidationCode;
  phase: typeof MCP_MANIFEST_VALIDATION_PHASE;
  path: string;
  message: string;
};

const PORTABLE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const PORTABLE_ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isStrictNonEmpty(value: string): boolean {
  return value.length > 0 && value === value.trim();
}

function validationIssue(
  code: McpManifestValidationCode,
  path: string,
  message: string,
): McpManifestValidationIssue {
  return { code, phase: MCP_MANIFEST_VALIDATION_PHASE, path, message };
}

function arkIssues(errors: ArkErrors): McpManifestValidationIssue[] {
  return Array.from(errors, (error) =>
    validationIssue(
      MCP_MANIFEST_VALIDATION_CODES.invalidManifestShape,
      error.path.length > 0 ? `$.${error.path.join(".")}` : "$",
      error.description ?? "Manifest must match the strict MCP v1 shape.",
    ),
  );
}

function pushNonEmpty(
  issues: McpManifestValidationIssue[],
  path: string,
  value: string | undefined,
): void {
  if (value !== undefined && !isStrictNonEmpty(value)) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.nonCanonicalString,
        path,
        "Must be non-empty without leading or trailing whitespace.",
      ),
    );
  }
}

function pushNonEmptyArray(
  issues: McpManifestValidationIssue[],
  path: string,
  values: string[] | undefined,
  requireEntry: boolean,
): void {
  if (requireEntry && values !== undefined && values.length === 0) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidToolFilter,
        path,
        "Must contain at least one value.",
      ),
    );
  }
  for (const [index, value] of (values ?? []).entries()) {
    pushNonEmpty(issues, `${path}.${index}`, value);
  }
}

/** Validate an MCP v1 manifest (mcp.json). See clawhub-schema/src/mcp.ts. */
export function validateMcpManifest(
  value: unknown,
): { ok: true; manifest: McpManifest } | { ok: false; issues: McpManifestValidationIssue[] } {
  const parsed = McpManifestSchema(value);
  if (parsed instanceof ArkErrors) return { ok: false, issues: arkIssues(parsed) };

  const issues: McpManifestValidationIssue[] = [];
  if (!PORTABLE_NAME_PATTERN.test(parsed.name)) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidName,
        "$.name",
        "Must be a lowercase portable id.",
      ),
    );
  }
  if (
    parsed.transport !== "stdio" &&
    parsed.transport !== "sse" &&
    parsed.transport !== "streamable-http"
  ) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidTransport,
        "$.transport",
        'Must be "stdio", "sse", or "streamable-http".',
      ),
    );
  }
  pushNonEmpty(issues, "$.description", parsed.description);
  if (parsed.command !== undefined && !isStrictNonEmpty(parsed.command)) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidCommand,
        "$.command",
        "Must be non-empty without leading or trailing whitespace.",
      ),
    );
  }
  pushNonEmptyArray(issues, "$.args", parsed.args, false);
  if (parsed.url !== undefined) {
    pushNonEmpty(issues, "$.url", parsed.url);
    try {
      const url = new URL(parsed.url);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
        throw new Error("protocol");
      }
      if (url.username || url.password || url.hash) {
        issues.push(
          validationIssue(
            MCP_MANIFEST_VALIDATION_CODES.mcpUrlCredentials,
            "$.url",
            "Must not contain embedded credentials or fragments.",
          ),
        );
      }
    } catch {
      issues.push(
        validationIssue(
          MCP_MANIFEST_VALIDATION_CODES.invalidMcpUrl,
          "$.url",
          "Must use HTTPS, except HTTP on an exact loopback host.",
        ),
      );
    }
  }
  if (parsed.transport !== "stdio" && parsed.url === undefined) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidMcpUrl,
        "$.url",
        "Remote transports require a url.",
      ),
    );
  }
  if (parsed.transport === "stdio" && parsed.command === undefined) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidCommand,
        "$.command",
        "stdio transports require a command.",
      ),
    );
  }
  pushNonEmptyArray(issues, "$.toolFilter.include", parsed.toolFilter?.include, true);
  pushNonEmptyArray(issues, `$.toolFilter.exclude`, parsed.toolFilter?.exclude, true);
  for (const field of ["include", "exclude"] as const) {
    const seen = new Set<string>();
    for (const [index, entry] of (parsed.toolFilter?.[field] ?? []).entries()) {
      if (entry.includes("?") || entry.includes("[") || entry.includes("]")) {
        issues.push(
          validationIssue(
            MCP_MANIFEST_VALIDATION_CODES.invalidToolFilter,
            `$.toolFilter.${field}.${index}`,
            "Tool filters support only exact names and * wildcards.",
          ),
        );
      }
      if (seen.has(entry)) {
        issues.push(
          validationIssue(
            MCP_MANIFEST_VALIDATION_CODES.duplicateToolFilter,
            `$.toolFilter.${field}.${index}`,
            "Tool filter entries must be unique.",
          ),
        );
      }
      seen.add(entry);
    }
  }
  if (parsed.env !== undefined) {
    for (const [key, val] of Object.entries(parsed.env)) {
      const envValue = typeof val === "string" ? val : "";
      pushNonEmpty(issues, "$.env", key);
      if (!PORTABLE_ENV_KEY_PATTERN.test(key)) {
        issues.push(
          validationIssue(
            MCP_MANIFEST_VALIDATION_CODES.invalidEnvironmentKey,
            `$.env.${key}`,
            "Invalid portable environment key.",
          ),
        );
      }
      if (envValue !== "${" + key + "}" && !isStrictNonEmpty(envValue)) {
        issues.push(
          validationIssue(
            MCP_MANIFEST_VALIDATION_CODES.invalidEnvironmentValue,
            `$.env.${key}`,
            "Must be non-empty without leading or trailing whitespace.",
          ),
        );
      }
    }
  }
  if (parsed.timeout !== undefined && (!Number.isFinite(parsed.timeout) || parsed.timeout <= 0)) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidTimeout,
        "$.timeout",
        "Must be positive.",
      ),
    );
  }
  if (
    parsed.connectTimeout !== undefined &&
    (!Number.isFinite(parsed.connectTimeout) || parsed.connectTimeout <= 0)
  ) {
    issues.push(
      validationIssue(
        MCP_MANIFEST_VALIDATION_CODES.invalidTimeout,
        "$.connectTimeout",
        "Must be positive.",
      ),
    );
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, manifest: parsed };
}

function truncateSummaryText(value: string | undefined, maxChars: number): string | undefined {
  if (!value) return undefined;
  return Array.from(value).slice(0, maxChars).join("");
}

export function summarizeMcpManifest(manifest: McpManifest): McpManifestSummary {
  const description = truncateSummaryText(manifest.description, MCP_SUMMARY_DESCRIPTION_MAX_CHARS);
  return {
    schemaVersion: MCP_SCHEMA_VERSION,
    name: manifest.name,
    ...(description ? { description } : {}),
    transport: manifest.transport,
    ...(manifest.command ? { command: manifest.command } : {}),
    ...(manifest.url ? { url: manifest.url } : {}),
    argCount: manifest.args?.length ?? 0,
    envCount: Object.keys(manifest.env ?? {}).length,
    toolCount:
      (manifest.toolFilter?.include?.length ?? 0) + (manifest.toolFilter?.exclude?.length ?? 0),
  };
}
