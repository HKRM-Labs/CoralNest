---
summary: "How to author, publish, and discover persona packages on ClawHub."
read_when:
  - Authoring a persona package
  - Publishing a persona to ClawHub
  - Discovering published personas through the package API
---

# Persona packages

A persona package is a versioned package that describes one OpenClaw persona:
a reusable identity with a name, description, traits, and instructions that the
assistant applies when acting in that persona. Personas are discoverable,
installable, and versioned like any other ClawHub package.

Persona is a stable, always-available family. No feature flag gates persona
publication.

## Package shape

A publishable persona package is a normal package directory with a
`package.json` that points to its manifest:

```json
{
  "name": "@acme/support-agent",
  "version": "1.0.0",
  "openclaw": {
    "persona": "persona.json"
  }
}
```

The manifest itself is `persona.json` (or `PERSONA.md`) at the package root,
unless `openclaw.persona` names a different package-relative path:

```json
{
  "schemaVersion": "1",
  "id": "support-agent",
  "name": "Support Agent",
  "description": "A friendly L1 support persona.",
  "identity": "You are a first-line support agent for Acme.",
  "traits": ["patient", "concise"],
  "instructions": ["Greet the user and ask for an account id.", "Escalate security issues to L2."]
}
```

A `PERSONA.md` manifest is prose-first: `#` heading for the name and free-form
markdown body for description and instructions.

Rules ClawHub enforces when validating a manifest:

- `id` (falling back to the package `name`) uses the portable form
  `^[a-z][a-z0-9_-]{0,63}$`;
- `name` is required and must be a non-empty string;
- `description` must be a non-empty string;
- each `traits` entry is a non-empty string;
- each `instructions` entry is a non-empty string.

## Validate and publish

Preview the package locally without uploading it:

```bash
clawhub package publish . --family persona --dry-run
```

Then publish through the normal authenticated package flow:

```bash
clawhub package publish . --family persona
```

The CLI detects `family: persona` when the package contains
`persona.json`/`PERSONA.md` or `package.json` declares `openclaw.persona`, so
`--family persona` is optional for a well-formed package.

Publication rejects:

- a missing, invalid, or escaping `openclaw.persona` path;
- package identity or version mismatches;
- a manifest that fails the identity, description, traits, or instructions
  rules above.

Accepted packages continue through ClawHub's existing ownership, moderation,
static scanning, release, and artifact storage pipeline. The stored release
keeps the exact artifact plus a non-sensitive `personaManifestSummary`
(schema version, id, name, a truncated description, and trait/instruction
counts) for search and detail surfaces; the full manifest stays inside the
artifact.

## Discover published personas

Personas are exposed through the existing package API:

```bash
curl "https://clawhub.ai/api/v1/packages?family=persona"
curl "https://clawhub.ai/api/v1/packages/search?q=support&family=persona"
curl "https://clawhub.ai/api/v1/packages/@acme%2Fsupport-agent"
```

List and search results use the normal package summary fields. Package and
version detail responses also include `personaManifestSummary` when the release
was published as a persona.
