import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowseActions,
  BrowseControls,
  BrowseControlsDivider,
  BrowseControlsRow,
  BrowseSearchInput,
  BrowseSearchPanel,
  BrowseSearchTrigger,
  BrowseTabs,
  useBrowseSearchDisclosure,
} from "../components/BrowseControls";
import { CatalogListRow } from "../components/catalog/CatalogListRow";
import { CoralPageWrapper } from "../components/CoralPageWrapper";
import { BrowseResultsSkeleton } from "../components/skeletons/BrowseResultsSkeleton";
import { rowString, searchAssetsClient } from "../lib/assetsClient";
import { ASSET_TYPES, type AssetRow, type AssetType } from "../lib/assetTypes";
import { catalogDetailHref } from "../lib/catalogPaths";

const SEARCH_PAGE_SIZE = 25;

type SearchType = "all" | AssetType;

const SEARCH_TABS: Array<{ value: SearchType; label: string; mobileLabel?: string }> = [
  { value: "all", label: "All" },
  { value: "skills", label: "Skills" },
  { value: "loops", label: "Loops" },
  { value: "graphs", label: "Graphs" },
  { value: "mcp_servers", label: "MCP" },
  { value: "connectors", label: "Connectors" },
  { value: "plugins", label: "Plugins" },
];

type SearchState = {
  q?: string;
  type?: SearchType;
};

function parseSearchType(value: unknown): SearchType | undefined {
  if (value === "all" || (typeof value === "string" && (ASSET_TYPES as string[]).includes(value))) {
    return value as SearchType;
  }
  if (value === "skills" || value === "plugins") return value;
  return undefined;
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchState => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
    type: parseSearchType(search.type),
  }),
  component: CatalogSearchPage,
});

type FetchState = {
  items: AssetRow[];
  total: number;
  loading: boolean;
  error: boolean;
};

function CatalogSearchPage() {
  const routeSearch = Route.useSearch();
  const navigate = useNavigate();
  const q = routeSearch.q ?? "";
  const activeType: SearchType = routeSearch.type ?? "all";

  const [fetchState, setFetchState] = useState<FetchState>({
    items: [],
    total: 0,
    loading: q !== "",
    error: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState(q);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchNavigateTimer = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    return () => {
      window.clearTimeout(searchNavigateTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = useCallback(
    async (limit: number, reset: boolean) => {
      const trimmed = q.trim();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (reset) {
        setFetchState((prev) => ({ ...prev, loading: true, error: false }));
      }
      const result = await searchAssetsClient(
        {
          query: trimmed || undefined,
          type: activeType,
          sortBy: "quality",
          limit: limit - (reset ? 0 : fetchState.items.length),
          offset: reset ? 0 : fetchState.items.length,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (result == null) {
        if (reset) setFetchState((prev) => ({ ...prev, loading: false, error: true }));
        return;
      }
      setFetchState((prev) => ({
        items: reset ? result.items : [...prev.items, ...result.items],
        total: result.total,
        loading: false,
        error: false,
      }));
    },
    [activeType, fetchState.items.length, q],
  );

  useEffect(() => {
    if (!q.trim()) {
      setFetchState({ items: [], total: 0, loading: false, error: false });
      return;
    }
    void runSearch(SEARCH_PAGE_SIZE, true);
  }, [q, activeType, runSearch]);

  const loadMore = useCallback(() => {
    if (fetchState.loading || loadingMore) return;
    setLoadingMore(true);
    void runSearch(SEARCH_PAGE_SIZE + fetchState.items.length, false).finally(() =>
      setLoadingMore(false),
    );
  }, [fetchState.items.length, fetchState.loading, loadingMore, runSearch]);

  const browseSearch = useBrowseSearchDisclosure({
    value: query,
    onClear: () => {
      window.clearTimeout(searchNavigateTimer.current);
      setQuery("");
      searchInputRef.current?.focus();
      void navigate({ search: { q: undefined, type: activeType } as never, replace: true });
    },
    inputRef: searchInputRef,
  });

  const handleQueryChange = (next: string) => {
    setQuery(next);
    window.clearTimeout(searchNavigateTimer.current);
    searchNavigateTimer.current = window.setTimeout(() => {
      void navigate({
        search: { q: next.trim() || undefined, type: activeType } as never,
        replace: true,
      });
    }, 300);
  };

  const handleQuerySubmit = () => {
    window.clearTimeout(searchNavigateTimer.current);
    void navigate({
      search: { q: query.trim() || undefined, type: activeType } as never,
      replace: false,
    });
  };

  const handleTypeChange = (value: string | undefined) => {
    const nextType = (value as SearchType) ?? "all";
    void navigate({
      search: { q: routeSearch.q, type: nextType === "all" ? undefined : nextType } as never,
      replace: true,
    });
  };

  const hasMore = !fetchState.loading && fetchState.items.length < fetchState.total;

  return (
    <CoralPageWrapper pageType="home">
      <div className="browse-page browse-page-borderless-header">
        <div className="browse-page-header">
          <div className="browse-page-header-main">
            <h1 className="browse-title">
              Search
              {q && !fetchState.loading && !fetchState.error ? (
                <span className="browse-count">{fetchState.total} results</span>
              ) : null}
            </h1>
            <p className="browse-subtitle">
              Search the entire CoralNest catalog across all registries.
            </p>
          </div>
        </div>

        <BrowseControls>
          <BrowseControlsRow>
            <BrowseTabs
              ariaLabel="Search scope"
              options={SEARCH_TABS}
              value={activeType}
              onChange={handleTypeChange}
            />
            <BrowseControlsDivider />
            <BrowseActions>
              <BrowseSearchTrigger
                open={browseSearch.open}
                onOpen={browseSearch.openSearch}
                label="Search catalog"
              />
            </BrowseActions>
            <BrowseSearchPanel open={browseSearch.open}>
              <BrowseSearchInput
                inputRef={searchInputRef}
                label="catalog search"
                placeholder="Search skills, loops, graphs, MCP servers, connectors, plugins..."
                value={query}
                onChange={handleQueryChange}
                onClear={browseSearch.closeSearch}
                onSubmit={handleQuerySubmit}
                closeLabel="Close search"
              />
            </BrowseSearchPanel>
          </BrowseControlsRow>
        </BrowseControls>

        <div className="browse-layout">
          <div className="browse-results">
            {!q.trim() ? (
              <div className="empty-state">
                <PackageSearch size={22} className="empty-state-icon" aria-hidden="true" />
                <p className="empty-state-title">Search the catalog</p>
                <p className="empty-state-body">Enter a query to search across all registries.</p>
              </div>
            ) : fetchState.loading ? (
              <BrowseResultsSkeleton label="Result" variant="list" />
            ) : fetchState.error ? (
              <div className="empty-state">
                <PackageSearch size={22} className="empty-state-icon" aria-hidden="true" />
                <p className="empty-state-title">Unable to search</p>
                <p className="empty-state-body">
                  The asset catalog is temporarily unavailable. Please try again later.
                </p>
              </div>
            ) : fetchState.items.length === 0 ? (
              <div className="empty-state">
                <PackageSearch size={22} className="empty-state-icon" aria-hidden="true" />
                <p className="empty-state-title">No results for “{q}”</p>
                <p className="empty-state-body">Try a different search term or scope.</p>
              </div>
            ) : (
              <div>
                {/* Column header — shares the row grid so the columns line up */}
                <div className="home-v2-listing-head is-catalog" aria-hidden="true">
                  <span className="home-v2-listing-head-label">Name</span>
                  <span className="home-v2-listing-head-mid">Category</span>
                  <span className="home-v2-listing-head-stat">Popularity</span>
                </div>
                {fetchState.items.map((item, index) => {
                  const type: AssetType =
                    (item.type as AssetType | undefined) ??
                    (activeType === "all" ? "skills" : activeType);
                  const slug = rowString(item, "slug") ?? "";
                  return (
                    <CatalogListRow
                      // biome-ignore lint/suspicious/noArrayIndexKey: row-level key includes slug
                      key={`${type}:${slug}:${index}`}
                      item={item}
                      type={type}
                      detailHref={catalogDetailHref(type, slug)}
                    />
                  );
                })}
              </div>
            )}

            {hasMore ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  className="catalog-download-btn rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </CoralPageWrapper>
  );
}
