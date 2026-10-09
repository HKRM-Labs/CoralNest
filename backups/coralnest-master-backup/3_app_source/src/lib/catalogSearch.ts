import type { AssetSortKey, AssetType } from "./assetTypes";

export type CatalogView = "list" | "grid";

export type CatalogSearchState = {
  tab?: AssetType | "all";
  q?: string;
  category?: string;
  framework?: string;
  transport?: string;
  sortBy?: AssetSortKey;
  view?: CatalogView;
  focus?: "search";
};

function parseString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseBoolString(value: unknown): boolean | undefined {
  return value === "1" || value === "true" || value === true ? true : undefined;
}

export function normalizeCatalogView(value: unknown): CatalogView | undefined {
  if (value === "list" || value === "grid") return value;
  return undefined;
}

export function isAssetSortKey(value: unknown): value is AssetSortKey {
  return value === "quality" || value === "downloads" || value === "stars" || value === "newest";
}

export function parseCatalogSearchState(
  search: Record<string, unknown>,
  allowedTabs: readonly (AssetType | "all")[],
  defaultTab: AssetType | "all",
): CatalogSearchState {
  const rawTab = parseString(search.tab);
  const tab =
    rawTab && (allowedTabs as string[]).includes(rawTab)
      ? (rawTab as AssetType | "all")
      : defaultTab;
  return {
    tab,
    q: parseString(search.q),
    category: parseString(search.category),
    framework: parseString(search.framework),
    transport: parseString(search.transport),
    sortBy: isAssetSortKey(search.sortBy) ? search.sortBy : undefined,
    view: normalizeCatalogView(search.view),
    focus: parseBoolString(search.focus) ? "search" : undefined,
  };
}

export type CatalogNavigate = (
  updater: (prev: CatalogSearchState) => CatalogSearchState,
  replace?: boolean,
) => void;

export function buildCatalogNavigator(
  currentSearch: CatalogSearchState,
  patch: (next: Record<string, unknown>, replace?: boolean) => void,
): CatalogNavigate {
  return (updater, replace) => {
    const next = updater(currentSearch);
    const params: Record<string, unknown> = {
      tab: next.tab,
      q: next.q,
      category: next.category,
      framework: next.framework,
      transport: next.transport,
      sortBy: next.sortBy,
      view: next.view,
      focus: next.focus === "search" ? "1" : undefined,
    };
    patch(params, replace);
  };
}
