# Flows Catalog

The agent-flows catalog (`/flows` page and `GET /api/v1/flows` HTTP action)
mixes two kinds of content into one browsable list:

- **Skills**: the live CoralNest/ClawHub skill catalog, via
  `api.skills.listPackageCatalogPage` (bounded to `FLOWS_SKILLS_PREVIEW_LIMIT`).
- **Open-source loops/graphs**: well-known flow files defined in
  `OPEN_FLOW_SOURCES` (convex/lib/openFlowsCatalog.ts) and parsed fresh from
  their upstream GitHub raw files per request.

## Kinds and labeling

- `skill` — live catalog skill (links to the skill detail page).
- `loop` — a flow with for-each/while/repeat control constructs.
- `graph` — a DAG/workflow of steps (including FlowAI-style `nodes` based flows).

The UI tabs (All / Skills / Loops / Graphs), the `kind` query parameter, and
the `kind` field on each item all use these three values.

## Response and resilience invariant

**Loop/graph items must always appear in the catalog.** Open-source flow
content is fetched live on every request, but a failed upstream fetch or a
parse failure must never silently drop a loop/graph from the UI:

1. Live fetch + parse is attempted per source.
2. On live failure, the source is served from a bundled verified snapshot
   (`convex/lib/openFlowsBundled.ts`, generated from the real upstream files).
3. Only a source that fails live AND bundled parsing is omitted.

The `sources` object reports outcome per source for clients/operators:

```ts
sources: {
  total: number;        // total open-flow source count
  ok: number;           // served from live upstream
  fallback: string[];   // source ids served from bundled snapshots (possible stale)
  failed: string[];     // source ids dropped entirely (failed live + bundled)
}
```

`ok` excludes `fallback` entries, so `total === ok + fallback.length + failed.length`
always holds. The frontend does not branch on `sources`; it renders `items` as-is.

## External links

Loops/graphs link to their upstream file (`source.url`, GitHub blob) in a new
tab; skills link to the in-app skill page. No third-party page is required for
the catalog to function, so this strong best-effort design choice (bundled
snapshots + live refresh) keeps the page useful even with no outbound network.

## Key files

- `packages/schema/src/flows.ts` — shared types + limits.
- `convex/lib/openFlowsCatalog.ts` — sources, JSONC/YAML parsers, live fetch
  with snapshot fallback.
- `convex/lib/openFlowsBundled.ts` — generated verified snapshots (regenerate
  by re-fetching each `sourceRawUrl` and re-parsing).
- `convex/httpApiV1/flowsV1.ts` — HTTP action handler.
- `src/lib/flowsApi.ts`, `src/routes/flows/index.tsx`,
  `src/components/FlowListItem.tsx` — client and UI.
