/**
 * Shared types for the agent-flows catalog (`/flows` page and
 * `/api/v1/flows` endpoint).
 *
 * A "flow" is a prompt-based agent recipe. Skills are the live CoralNest
 * skill catalog (ClawHub `skills`); loops and graphs are open-source agent
 * flows, fetched live from their upstream repositories at request time and
 * served from bundled verified snapshots when a live fetch/parse fails, so
 * the catalog never silently drops loops/graphs.
 */

export type FlowItemKind = "skill" | "loop" | "graph";

export type OpenFlowSource = {
  /** Stable slug id used for the catalog item, e.g. `agent-loop-flow/simple-sequential`. */
  id: string;
  kind: "loop" | "graph";
  /** GitHub repository in `owner/repo` form, used for the source link. */
  repo: string;
  /** Branch of the repository that is fetched. */
  branch?: string;
  /** Path of the flow file inside the repository, e.g. `examples/simple-sequential.jsonc`. */
  path: string;
  /** Optional display label when the upstream flow file has no `name`. */
  displayName?: string;
  topics?: string[];
};

export type FlowSkillItem = {
  kind: "skill";
  /** Normalized CoralNest skill slug. */
  name: string;
  displayName: string;
  summary: string | null;
  ownerHandle: string | null;
  topics: string[];
  stats: Record<string, number>;
  createdAt: number;
  updatedAt: number;
};

export type OpenFlowEntry = {
  kind: "loop" | "graph";
  /** Stable catalog id, e.g. `agent-loop-loop/simple-sequential`. */
  id: string;
  name: string;
  displayName: string;
  summary: string | null;
  /** Default agent run tool the upstream flow targets, if declared. */
  defaultTool?: string;
  /** Number of discrete steps/nodes declared by the upstream flow. */
  stepCount: number;
  /** Loop control kinds detected in the flow (e.g. `while`, `for-each`). */
  loopKinds: string[];
  topics: string[];
  source: {
    repo: string;
    path: string;
    url: string;
  };
  updatedAt: number;
};

export type FlowCatalogItem = FlowSkillItem | OpenFlowEntry;

export type FlowsCatalogResponse = {
  items: FlowCatalogItem[];
  totalCount: number;
  nextCursor: null;
  /** Per-source fetch outcome so clients can degrade gracefully. */
  sources: {
    total: number;
    /** Number of open-flow sources served from live upstream content. */
    ok: number;
    /** Source ids whose live upstream fetch failed AND were served from a bundled snapshot. */
    fallback: string[];
    /** Source ids that failed both live AND bundled parsing (omitted from items). */
    failed: string[];
  };
};

export const MAX_FLOWS_CATALOG_LIMIT = 100;
/** Bounded skills preview included alongside open-source loops/graphs. */
export const FLOWS_SKILLS_PREVIEW_LIMIT = 20;
