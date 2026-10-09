---
summary: "How to author, publish, and discover MCP server packages on ClawHub."
read_when:
  - Authoring an MCP server package
  - Publishing an MCP server to ClawHub
  - Discovering published MCP servers through the package API
---

# MCP server packages

An MCP package is a versioned package that describes one Model Context
Protocol (MCP) server: how OpenClaw should start it (stdio) or reach it
(remote SSE or streamable HTTP), the environment it needs, and which tools it
exposes. ClawHub stores and scans the package; OpenClaw owns connecting to the
server as part of the user's MCP configuration.

MCP is a stable, always-available family. Unlike experimental Claws, no
feature flag gates MCP publication.

## Package shape

A publishable MCP package is a normal package directory with a `package.json`
that points to its manifest:

```json
{
  "name": "@acme/github-mcp",
  "version": "1.0.0",
  "openclaw": {
    "mcp": "mcp.json"
  }
}
```

The manifest itself is `mcp.json` (or `.mcp.json`) at the package root, unless
`openclaw.mcp` names a different package-relative path:

```json
{
  "schemaVersion": "1",
  "name": "github-mcp",
  "description": "Exposes GitHub issues and PRs over MCP.",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@acme/github-mcp"],
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  },
  "toolFilter": {
    "include": ["github.*"]
  },
  "timeout": 30000,
  "connectTimeout": 15000
}
```

Rules ClawHub enforces when validating a manifest:

- `name` (and profile `id`) use the portable form `^[a-z][a-z0-9_-]{0,63}$`;
- stdio servers require `command`; remote transports (`sse`,
  `streamable-http`) require `url`;
- remote URLs must use `https`, or `http` only for exact loopback hosts, and
  must not embed credentials;
- `toolFilter.include`/`exclude` entries are exact tool names with at most a
  single trailing `*` wildcard, and may not repeat;
- `env` keys must be portable identifiers; values are written as-is or as
  `"${PARENT_KEY}"` substitution markers, never resolved secrets;
- `timeout` and `connectTimeout`, when present, must be positive numbers.

## Validate and publish

Preview the package locally without uploading it:

```bash
clawhub package publish . --family mcp --dry-run
```

Then publish through the normal authenticated package flow:

```bash
clawhub package publish . --family mcp
```

The CLI detects `family: mcp` when the package contains `mcp.json`/`.mcp.json`
or `package.json` declares `openclaw.mcp`, so `--family mcp` is optional for a
well-formed package.

Publication rejects:

- a missing, invalid, or escaping `openclaw.mcp` path;
- package identity or version mismatches;
- a manifest that fails the transport, URL, tool filter, or environment rules
  above.

Accepted packages continue through ClawHub's existing ownership, moderation,
static scanning, release, and artifact storage pipeline. The stored release
keeps the exact artifact plus a non-sensitive `mcpManifestSummary` (schema
version, name, transport, command, URL, and tool/env/arg counts) for search and
detail surfaces; the full manifest stays inside the artifact.

## Discover published MCP servers

MCP servers are exposed through the existing package API:

```bash
curl "https://clawhub.ai/api/v1/packages?family=mcp"
curl "https://clawhub.ai/api/v1/packages/search?q=github&family=mcp"
curl "https://clawhub.ai/api/v1/packages/@acme%2Fgithub-mcp"
```

List and search results use the normal package summary fields. Package and
version detail responses also include `mcpManifestSummary` when the release was
published as an MCP server.
