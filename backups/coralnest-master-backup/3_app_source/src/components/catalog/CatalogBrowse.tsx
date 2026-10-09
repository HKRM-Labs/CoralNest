import { PackageSearch } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAssetCountsClient,
  getAssetFilterOptionsClient,
  rowString,
  searchAssetsClient,
} from "../../lib/assetsClient";
import {
  ASSET_TYPES,
  type AssetCountsResponse,
  type AssetFilterOptionsResponse,
  type AssetRow,
  type AssetSortKey,
  type AssetType,
} from "../../lib/assetTypes";
import { formatBrowseCount } from "../../lib/browseCount";
import type { CatalogNavigate, CatalogSearchState, CatalogView } from "../../lib/catalogSearch";
import type { BrowseCategory } from "../../lib/categories";
import {
  BrowseActions,
  BrowseCategorySelect,
  BrowseCategorySidebar,
  BrowseControls,
  BrowseControlsDivider,
  BrowseControlsRow,
  BrowseSearchInput,
  BrowseSearchPanel,
  BrowseSearchTrigger,
  BrowseSortSelect,
  BrowseTabs,
  BrowseViewToggle,
  useBrowseSearchDisclosure,
} from "../BrowseControls";
import { CoralPageWrapper } from "../CoralPageWrapper";
import { BrowseResultsSkeleton } from "../skeletons/BrowseResultsSkeleton";
import { CatalogCard } from "./CatalogCard";
import { CatalogListRow } from "./CatalogListRow";

export type CatalogTabDef = {
  value: AssetType | "all";
  label: string;
  mobileLabel?: string;
  icon?: React.ReactNode;
};

type CatalogBrowseProps = {
  pageType: "skills" | "flows" | "plugins" | "connectors" | "mcp" | "home";
  title: string;
  subtitle: string;
  tabs?: CatalogTabDef[];
  defaultType: AssetType | "all";
  search: CatalogSearchState;
  onNavigate: CatalogNavigate;
  detailHref: (type: AssetType, slug: string) => string;
  searchLabel: string;
  searchPlaceholder: string;
};

const PAGE_SIZE = 25;

const SORT_OPTIONS: ReadonlyArray<{ value: AssetSortKey; label: string }> = [
  { value: "quality", label: "Recommended" },
  { value: "downloads", label: "Most downloaded" },
  { value: "stars", label: "Most starred" },
  { value: "newest", label: "Newest" },
];

type FetchState = {
  items: AssetRow[];
  total: number;
  loading: boolean;
  error: boolean;
};

function createEmptyFetchState(): FetchState {
  return { items: [], total: 0, loading: true, error: false };
}

function catalogListRowLabel(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toBrowseCategories(slugs: readonly string[] | undefined): BrowseCategory[] {
  return (slugs ?? [])
    .filter(Boolean)
    .map((slug) => ({ slug, label: catalogListRowLabel(slug), icon: "" }));
}

export function CatalogBrowse({
  pageType,
  title,
  subtitle,
  tabs,
  defaultType,
  search,
  onNavigate,
  detailHref,
  searchLabel,
  searchPlaceholder,
}: CatalogBrowseProps) {
  const activeType: AssetType | "all" = search.tab ?? defaultType;
  const q = search.q ?? "";
  const category = search.category;
  const framework = search.framework;
  const transport = search.transport;
  const sortBy = search.sortBy;
  const view: CatalogView = search.view ?? "list";

  const [fetchState, setFetchState] = useState<FetchState>(createEmptyFetchState);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<AssetCountsResponse | null>(null);
  const [filterOptions, setFilterOptions] = useState<AssetFilterOptionsResponse | null>(null);
  const [searchInput, setSearchInput] = useState(q);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchNavigateTimer = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    return () => window.clearTimeout(searchNavigateTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getAssetCountsClient()
      .then((countsResult) => {
        if (!cancelled && countsResult) setCounts(countsResult);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeType === "all") {
      setFilterOptions(null);
      setFiltersLoading(false);
      return undefined;
    }
    let cancelled = false;
    setFiltersLoading(true);
    void getAssetFilterOptionsClient(activeType)
      .then((options) => {
        if (cancelled) return;
        setFilterOptions(options);
      })
      .catch(() => {
        if (!cancelled) setFilterOptions(null);
      })
      .finally(() => {
        if (!cancelled) setFiltersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeType]);

  const runSearch = useCallback(
    async (offset: number, append: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!append) {
        setFetchState((prev) => ({ ...prev, loading: true, error: false }));
      }
      const result = await searchAssetsClient(
        {
          type: activeType,
          query: q || undefined,
          category: activeType === "all" ? undefined : category,
          framework: activeType === "all" ? undefined : framework,
          transport: activeType === "all" ? undefined : transport,
          sortBy: sortBy === "quality" ? undefined : sortBy,
          limit: PAGE_SIZE,
          offset,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (result == null) {
        if (!append) setFetchState((prev) => ({ ...prev, loading: false, error: true }));
        return;
      }
      setFetchState((prev) => ({
        items: append ? [...prev.items, ...result.items] : result.items,
        // For type=all, result.total is just items.length (one page). Use the
        // sum of per-type counts from the response for the real total instead.
        total:
          activeType === "all" && result.counts
            ? Object.values(result.counts).reduce((s, n) => s + (n ?? 0), 0)
            : result.total,
        loading: false,
        error: false,
      }));
    },
    [activeType, q, category, framework, transport, sortBy],
  );

  useEffect(() => {
    void runSearch(0, false);
    return () => abortRef.current?.abort();
  }, [runSearch]);

  const loadMore = useCallback(() => {
    if (fetchState.loading || loadingMore) return;
    setLoadingMore(true);
    void runSearch(fetchState.items.length, true).finally(() => setLoadingMore(false));
  }, [fetchState.loading, fetchState.items.length, loadingMore, runSearch]);

  const filterCategories = toBrowseCategories(filterOptions?.categories);
  const activeFilter = category;
  const setActiveFilter = (value: string | undefined) => {
    onNavigate((prev) => ({ ...prev, category: value }), true);
  };
  const secondarySlugs =
    activeType === "graphs"
      ? filterOptions?.frameworks
      : activeType === "mcp_servers"
        ? filterOptions?.transports
        : undefined;
  const secondaryTitle =
    activeType === "graphs"
      ? "Frameworks"
      : activeType === "mcp_servers"
        ? "Transports"
        : undefined;
  const activeSecondary =
    activeType === "graphs" ? framework : activeType === "mcp_servers" ? transport : undefined;
  const setActiveSecondary = (value: string | undefined) => {
    const key =
      activeType === "graphs"
        ? "framework"
        : activeType === "mcp_servers"
          ? "transport"
          : "category";
    onNavigate((prev) => ({ ...prev, [key]: value }), true);
  };
  const showFilters = activeType !== "all";

  const sidebarSections = showFilters
    ? [
        {
          title: "Categories",
          categories: filterCategories,
          value: activeFilter,
          onChange: setActiveFilter,
        },
        ...(secondaryTitle && (secondarySlugs ?? []).length > 0
          ? [
              {
                title: secondaryTitle,
                categories: toBrowseCategories(secondarySlugs),
                value: activeSecondary,
                onChange: setActiveSecondary,
              },
            ]
          : []),
      ]
    : [];

  const hasMore = !fetchState.loading && fetchState.items.length < fetchState.total;

  const tabOptions = tabs
    ? tabs.map((tab) => {
        const count =
          counts != null
            ? tab.value === "all"
              ? ASSET_TYPES.reduce((sum, type) => sum + (counts[type] ?? 0), 0)
              : (counts[tab.value] ?? 0)
            : null;
        return count != null
          ? { ...tab, label: `${tab.label} (${formatBrowseCount(count)})` }
          : tab;
      })
    : undefined;

  const browseSearch = useBrowseSearchDisclosure({
    value: q,
    onClear: () => {
      window.clearTimeout(searchNavigateTimer.current);
      setSearchInput("");
      searchInputRef.current?.focus();
      onNavigate((prev) => ({ ...prev, q: undefined }), true);
    },
    inputRef: searchInputRef,
  });

  const handleQueryChange = (next: string) => {
    setSearchInput(next);
    window.clearTimeout(searchNavigateTimer.current);
    searchNavigateTimer.current = window.setTimeout(() => {
      onNavigate((prev) => ({ ...prev, q: next.trim() ? next : "" }), true);
    }, 250);
  };

  const handleQuerySubmit = () => {
    window.clearTimeout(searchNavigateTimer.current);
    onNavigate((prev) => ({ ...prev, q: searchInput.trim() }), false);
  };

  const handleTabChange = (value: string | undefined) => {
    onNavigate(
      (prev) => ({
        ...prev,
        tab: (value as AssetType | "all") ?? defaultType,
        q: undefined,
        category: undefined,
        framework: undefined,
        transport: undefined,
      }),
      true,
    );
  };

  const handleToggleView = () => {
    onNavigate((prev) => ({ ...prev, view: prev.view === "grid" ? "list" : "grid" }), true);
  };

  // For single-type pages (no tabs), derive count from the search result total
  // which is always available after the first fetch. For multi-type/all pages
  // we still use the separate counts call since search total only covers one type.
  const shownCount =
    !fetchState.loading && fetchState.total > 0
      ? formatBrowseCount(
          activeType !== "all"
            ? fetchState.total
            : counts
              ? ASSET_TYPES.reduce((sum, t) => sum + (counts[t] ?? 0), 0)
              : fetchState.total,
        )
      : activeType !== "all" && counts
        ? formatBrowseCount(counts[activeType])
        : counts
          ? formatBrowseCount(ASSET_TYPES.reduce((sum, t) => sum + (counts[t] ?? 0), 0))
          : null;

  return (
    <CoralPageWrapper pageType={pageType}>
      <div className="browse-page browse-page-borderless-header">
        <div className="browse-page-header">
          <div className="browse-page-header-main">
            <h1 className="browse-title">
              {title}
              {shownCount != null ? <span className="browse-count">{shownCount}</span> : null}
            </h1>
            <p className="browse-subtitle">{subtitle}</p>
          </div>
        </div>

        <BrowseControls>
          <BrowseControlsRow>
            {tabOptions ? (
              <BrowseTabs
                ariaLabel="Catalog type"
                options={tabOptions}
                value={activeType}
                onChange={handleTabChange}
              />
            ) : null}
            {tabs ? <BrowseControlsDivider /> : null}
            <BrowseActions>
              <BrowseSearchTrigger
                open={browseSearch.open}
                onOpen={browseSearch.openSearch}
                label={searchLabel}
              />
              {showFilters ? (
                <BrowseCategorySelect
                  categories={filterCategories}
                  value={activeFilter}
                  onChange={setActiveFilter}
                  responsive
                />
              ) : null}
              <BrowseSortSelect
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={(value) =>
                  onNavigate(
                    (prev) => ({ ...prev, sortBy: (value as AssetSortKey) ?? undefined }),
                    true,
                  )
                }
              />
              <BrowseViewToggle view={view} onToggle={handleToggleView} />
            </BrowseActions>
            <BrowseSearchPanel open={browseSearch.open}>
              <BrowseSearchInput
                inputRef={searchInputRef}
                label={searchLabel}
                placeholder={searchPlaceholder}
                value={searchInput}
                onChange={handleQueryChange}
                onClear={browseSearch.closeSearch}
                onSubmit={handleQuerySubmit}
                closeLabel="Close search"
              />
            </BrowseSearchPanel>
          </BrowseControlsRow>
        </BrowseControls>

        <div className={showFilters ? "browse-layout browse-layout-with-sidebar" : "browse-layout"}>
          {showFilters ? (
            <BrowseCategorySidebar
              ariaLabel="Filter by category"
              sections={sidebarSections}
              disabled={filtersLoading}
            />
          ) : null}
          <div className="browse-results">
            {fetchState.loading ? (
              <BrowseResultsSkeleton label="Asset" variant={view === "grid" ? "grid" : "list"} />
            ) : fetchState.error ? (
              <div className="empty-state">
                <PackageSearch size={22} className="empty-state-icon" aria-hidden="true" />
                <p className="empty-state-title">Unable to load the catalog</p>
                <p className="empty-state-body">
                  The asset catalog is temporarily unavailable. Please try again later.
                </p>
              </div>
            ) : fetchState.items.length === 0 ? (
              <div className="empty-state">
                <PackageSearch size={22} className="empty-state-icon" aria-hidden="true" />
                <p className="empty-state-title">No items found</p>
                <p className="empty-state-body">
                  {q
                    ? "Try a different search term or remove filters."
                    : "Nothing in this section yet."}
                </p>
              </div>
            ) : view === "grid" ? (
              <div className="grid browse-results-grid">
                {fetchState.items.map((item, index) => {
                  const type = (item.type as AssetType) ?? activeType;
                  const slug = rowString(item, "slug") ?? "";
                  return (
                    <CatalogCard
                      // biome-ignore lint/suspicious/noArrayIndexKey: row-level key includes slug
                      key={`${type}:${slug}:${index}`}
                      item={item}
                      type={type}
                      detailHref={detailHref(type, slug)}
                    />
                  );
                })}
              </div>
            ) : (
              <div>
                {/* Column header — shares the row grid so the columns line up */}
                <div className="home-v2-listing-head is-catalog" aria-hidden="true">
                  <span className="home-v2-listing-head-label">Name</span>
                  <span className="home-v2-listing-head-mid">Category</span>
                  <span className="home-v2-listing-head-stat">Popularity</span>
                </div>
                <div>
                  {fetchState.items.map((item, index) => {
                    const type = (item.type as AssetType) ?? activeType;
                    const slug = rowString(item, "slug") ?? "";
                    return (
                      <CatalogListRow
                        // biome-ignore lint/suspicious/noArrayIndexKey: row-level key includes slug
                        key={`${type}:${slug}:${index}`}
                        item={item}
                        type={type}
                        detailHref={detailHref(type, slug)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {hasMore ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
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
