import { createFileRoute } from "@tanstack/react-router";
import { CatalogBrowse } from "../../components/catalog/CatalogBrowse";
import {
  buildCatalogNavigator,
  parseCatalogSearchState,
  type CatalogSearchState,
} from "../../lib/catalogSearch";

export const Route = createFileRoute("/connectors/")({
  validateSearch: (search): CatalogSearchState =>
    parseCatalogSearchState(search, ["connectors"], "connectors"),
  component: ConnectorsBrowsePage,
});

function ConnectorsBrowsePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onNavigate = buildCatalogNavigator(search, (next, replace) => {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace });
  });

  return (
    <CatalogBrowse
      pageType="connectors"
      title="Connectors"
      subtitle="Pre-built integrations for SaaS platforms and APIs."
      defaultType="connectors"
      search={search}
      onNavigate={onNavigate}
      detailHref={(_type, slug) => `/connectors/${slug}`}
      searchLabel="Search connectors"
      searchPlaceholder="Search connectors..."
    />
  );
}
