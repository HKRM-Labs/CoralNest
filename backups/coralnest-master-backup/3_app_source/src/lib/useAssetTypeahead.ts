import { useEffect, useRef, useState } from "react";
import { searchAssetsClient } from "./assetsClient";
import type { AssetRow, AssetType } from "./assetTypes";
import { ASSET_TYPES } from "./assetTypes";

export type AssetTypeaheadGroup = {
  type: AssetType;
  label: string;
  items: AssetRow[];
};

const TYPEAHEAD_LABELS: Record<AssetType, string> = {
  skills: "Skills",
  loops: "Loops",
  graphs: "Graphs",
  mcp_servers: "MCP servers",
  connectors: "Connectors",
  plugins: "Plugins",
};

type AssetTypeaheadOptions = {
  debounceMs?: number;
  enabled?: boolean;
  limit?: number;
};

/**
 * Debounced catalog typeahead backed by the local Cockroach asset API.
 * Returns rows grouped by asset type so the header search can render one
 * section per registry. Replaces the legacy Convex `useUnifiedSearch`.
 */
export function useAssetTypeahead(
  query: string,
  options: AssetTypeaheadOptions = {},
): {
  groups: AssetTypeaheadGroup[];
  hasResults: boolean;
  isSearching: boolean;
} {
  const debounceMs = options.debounceMs ?? 180;
  const enabled = options.enabled ?? true;
  const limit = Math.max(1, Math.min(options.limit ?? 4, 25));
  const trimmedQuery = query.trim();
  const requestRef = useRef(0);
  const [groups, setGroups] = useState<AssetTypeaheadGroup[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!enabled || !trimmedQuery) {
      requestRef.current += 1;
      setGroups([]);
      setHasResults(false);
      setIsSearching(false);
      return () => {};
    }

    requestRef.current += 1;
    const requestId = requestRef.current;
    const controller = new AbortController();
    setIsSearching(true);

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await searchAssetsClient(
            { query: trimmedQuery, type: "all", sortBy: "quality", limit },
            controller.signal,
          );
          if (requestId !== requestRef.current) return;

          const next: AssetTypeaheadGroup[] = [];
          for (const type of ASSET_TYPES) {
            const items = (response?.items ?? []).filter(
              (item): item is AssetRow & { type: AssetType } => item.type === type,
            );
            if (items.length === 0) continue;
            next.push({ type, label: TYPEAHEAD_LABELS[type], items });
          }
          setGroups(next);
          setHasResults(next.length > 0);
        } catch {
          if (requestId === requestRef.current) {
            setGroups([]);
            setHasResults(false);
          }
        } finally {
          if (requestId === requestRef.current) {
            setIsSearching(false);
          }
        }
      })();
    }, debounceMs);

    return () => {
      requestRef.current += 1;
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [trimmedQuery, enabled, debounceMs, limit]);

  return { groups, hasResults, isSearching };
}
