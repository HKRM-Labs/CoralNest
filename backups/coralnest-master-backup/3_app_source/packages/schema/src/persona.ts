import { ArkErrors, type BaseType, type inferred, type } from "arktype";

// Persona manifests are scaffolding for ClawHub's assistant-persona content
// type. The concrete contents ("about me") are still being defined; the
// structure and summary contract below is the durable part that publish,
// browse, and install surfaces can already rely on.

export const PERSONA_SCHEMA_VERSION = 1 as const;
export const PERSONA_SUMMARY_NAME_MAX_CHARS = 128;
export const PERSONA_SUMMARY_DESCRIPTION_MAX_CHARS = 1_024;
export const PERSONA_MANIFEST_FILE_NAMES = ["persona.json", "PERSONA.md"] as const;
export const PERSONA_PACKAGE_JSON_FIELD = "openclaw.persona" as const;

const StrictStringArraySchema = type("string[]");

export const PersonaManifestSchema = type({
  "+": "reject",
  schemaVersion: "1",
  id: "string",
  name: "string?",
  description: "string?",
  identity: type({
    "+": "reject",
    name: "string?",
    theme: "string?",
    emoji: "string?",
    avatar: "string?",
  }).optional(),
  traits: StrictStringArraySchema.optional(),
  instructions: type({
    "+": "reject",
    source: "string?",
    files: StrictStringArraySchema.optional(),
  }).optional(),
});
export type PersonaManifest = (typeof PersonaManifestSchema)[inferred];

export type PersonaManifestSummary = {
  schemaVersion: 1;
  id: string;
  name?: string;
  description?: string;
  traitCount: number;
  instructionFileCount: number;
};

export type PersonaManifestSummarySchemaAdapter<TValue, TOptional = TValue> = {
  literalOne: TValue;
  string: TValue;
  number: TValue;
  boundedString: (maxCharacters: number) => TValue;
  optional: (schema: TValue) => TOptional;
  object: (fields: Record<string, TValue | TOptional>) => TValue;
};

/** Builds the v1 summary structure for both the public schema and durable storage validators. */
export function createPersonaManifestSummarySchema<TValue, TOptional = TValue>(
  adapter: PersonaManifestSummarySchemaAdapter<TValue, TOptional>,
): TValue {
  return adapter.object({
    schemaVersion: adapter.literalOne,
    id: adapter.string,
    name: adapter.optional(adapter.boundedString(PERSONA_SUMMARY_NAME_MAX_CHARS)),
    description: adapter.optional(adapter.boundedString(PERSONA_SUMMARY_DESCRIPTION_MAX_CHARS)),
    traitCount: adapter.number,
    instructionFileCount: adapter.number,
  });
}

export const PersonaManifestSummarySchema = createPersonaManifestSummarySchema<
  BaseType,
  [BaseType, "?"]
>({
  literalOne: type("1"),
  string: type("string"),
  number: type("number"),
  boundedString: (maxCharacters) =>
    type("string").narrow((value) => Array.from(value).length <= maxCharacters),
  optional: (schema) => schema.optional(),
  object: (fields) => type({ "+": "reject", ...fields }),
}) as BaseType<PersonaManifestSummary>;

export const PERSONA_MANIFEST_VALIDATION_PHASE = "schema" as const;
export const PERSONA_MANIFEST_VALIDATION_CODES = {
  invalidManifestShape: "persona_v1_invalid_manifest_shape",
  invalidId: "persona_v1_invalid_id",
  nonCanonicalString: "persona_v1_non_canonical_string",
  emptyList: "persona_v1_empty_list",
  invalidAvatar: "persona_v1_invalid_avatar",
} as const;
export type PersonaManifestValidationCode =
  (typeof PERSONA_MANIFEST_VALIDATION_CODES)[keyof typeof PERSONA_MANIFEST_VALIDATION_CODES];
export type PersonaManifestValidationIssue = {
  code: PersonaManifestValidationCode;
  phase: typeof PERSONA_MANIFEST_VALIDATION_PHASE;
  path: string;
  message: string;
};

const PERSONA_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const AVATAR_DATA_URL_PATTERN = /^data:image\/[^,]*,/i;
const AVATAR_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|svg)$/i;

function isStrictNonEmpty(value: string): boolean {
  return value.length > 0 && value === value.trim();
}

function validationIssue(
  code: PersonaManifestValidationCode,
  path: string,
  message: string,
): PersonaManifestValidationIssue {
  return { code, phase: PERSONA_MANIFEST_VALIDATION_PHASE, path, message };
}

function arkIssues(errors: ArkErrors): PersonaManifestValidationIssue[] {
  return Array.from(errors, (error) =>
    validationIssue(
      PERSONA_MANIFEST_VALIDATION_CODES.invalidManifestShape,
      error.path.length > 0 ? `$.${error.path.join(".")}` : "$",
      error.description ?? "Manifest must match the strict Persona v1 shape.",
    ),
  );
}

function pushNonEmpty(
  issues: PersonaManifestValidationIssue[],
  path: string,
  value: string | undefined,
): void {
  if (value !== undefined && !isStrictNonEmpty(value)) {
    issues.push(
      validationIssue(
        PERSONA_MANIFEST_VALIDATION_CODES.nonCanonicalString,
        path,
        "Must be non-empty without leading or trailing whitespace.",
      ),
    );
  }
}

function pushNonEmptyArray(
  issues: PersonaManifestValidationIssue[],
  path: string,
  values: string[] | undefined,
  requireEntry: boolean,
): void {
  if (requireEntry && values !== undefined && values.length === 0) {
    issues.push(
      validationIssue(
        PERSONA_MANIFEST_VALIDATION_CODES.emptyList,
        path,
        "Must contain at least one value.",
      ),
    );
  }
  for (const [index, value] of (values ?? []).entries()) {
    pushNonEmpty(issues, `${path}.${index}`, value);
  }
}

/** Validate a Persona v1 manifest. Persona contents are still being defined; shape stays strict. */
export function validatePersonaManifest(
  value: unknown,
):
  | { ok: true; manifest: PersonaManifest }
  | { ok: false; issues: PersonaManifestValidationIssue[] } {
  const parsed = PersonaManifestSchema(value);
  if (parsed instanceof ArkErrors) return { ok: false, issues: arkIssues(parsed) };

  const issues: PersonaManifestValidationIssue[] = [];
  if (!PERSONA_ID_PATTERN.test(parsed.id)) {
    issues.push(
      validationIssue(
        PERSONA_MANIFEST_VALIDATION_CODES.invalidId,
        "$.id",
        "Invalid portable persona id.",
      ),
    );
  }
  pushNonEmpty(issues, "$.name", parsed.name);
  pushNonEmpty(issues, "$.description", parsed.description);
  for (const field of ["name", "theme", "emoji", "avatar"] as const) {
    pushNonEmpty(issues, `$.identity.${field}`, parsed.identity?.[field]);
  }
  pushNonEmptyArray(issues, "$.traits", parsed.traits, true);
  const avatar = parsed.identity?.avatar;
  if (
    avatar !== undefined &&
    !AVATAR_DATA_URL_PATTERN.test(avatar) &&
    !AVATAR_EXTENSION_PATTERN.test(avatar)
  ) {
    issues.push(
      validationIssue(
        PERSONA_MANIFEST_VALIDATION_CODES.invalidAvatar,
        "$.identity.avatar",
        "Must be an image data URL or a supported image path.",
      ),
    );
  }
  pushNonEmpty(issues, "$.instructions.source", parsed.instructions?.source);
  pushNonEmptyArray(issues, "$.instructions.files", parsed.instructions?.files, false);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, manifest: parsed };
}

function truncateSummaryText(value: string | undefined, maxChars: number): string | undefined {
  if (!value) return undefined;
  return Array.from(value).slice(0, maxChars).join("");
}

export function summarizePersonaManifest(manifest: PersonaManifest): PersonaManifestSummary {
  const name = truncateSummaryText(manifest.name, PERSONA_SUMMARY_NAME_MAX_CHARS);
  const description = truncateSummaryText(
    manifest.description,
    PERSONA_SUMMARY_DESCRIPTION_MAX_CHARS,
  );
  return {
    schemaVersion: PERSONA_SCHEMA_VERSION,
    id: manifest.id,
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    traitCount: manifest.traits?.length ?? 0,
    instructionFileCount: manifest.instructions?.files?.length ?? 0,
  };
}
