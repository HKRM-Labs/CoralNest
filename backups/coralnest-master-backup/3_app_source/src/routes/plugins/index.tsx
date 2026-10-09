import { createFileRoute } from "@tanstack/react-router";
import { CatalogBrowse } from "../../components/catalog/CatalogBrowse";
import {
  buildCatalogNavigator,
  parseCatalogSearchState,
  type CatalogSearchState,
} from "../../lib/catalogSearch";

export const Route = createFileRoute("/plugins/")({
  validateSearch: (search): CatalogSearchState =>
    parseCatalogSearchState(search, ["plugins"], "plugins"),
  component: PluginsBrowsePage,
});

function PluginsBrowsePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onNavigate = buildCatalogNavigator(search, (next, replace) => {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace });
  });

  return (
    <CatalogBrowse
      pageType="plugins"
      title="Plugins"
      subtitle="Extendable modules, integrations, and tools for OpenClaw agents."
      defaultType="plugins"
      search={search}
      onNavigate={onNavigate}
      detailHref={(_type, slug) => `/plugins/catalog/${slug}`}
      searchLabel="Search plugins"
      searchPlaceholder="Search plugins..."
    />
  );
}
