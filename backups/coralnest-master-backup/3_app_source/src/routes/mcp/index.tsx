import { createFileRoute } from "@tanstack/react-router";
import { CatalogBrowse } from "../../components/catalog/CatalogBrowse";
import {
  buildCatalogNavigator,
  parseCatalogSearchState,
  type CatalogSearchState,
} from "../../lib/catalogSearch";

export const Route = createFileRoute("/mcp/")({
  validateSearch: (search): CatalogSearchState =>
    parseCatalogSearchState(search, ["mcp_servers"], "mcp_servers"),
  component: McpBrowsePage,
});

function McpBrowsePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onNavigate = buildCatalogNavigator(search, (next, replace) => {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace });
  });

  return (
    <CatalogBrowse
      pageType="mcp"
      title="MCP"
      subtitle="Model Context Protocol servers for agent tool access."
      defaultType="mcp_servers"
      search={search}
      onNavigate={onNavigate}
      detailHref={(_type, slug) => `/mcp/${slug}`}
      searchLabel="Search MCP servers"
      searchPlaceholder="Search MCP servers..."
    />
  );
}
