import { createFileRoute } from "@tanstack/react-router";
import { buildCatalogNavigator, parseCatalogSearchState } from "../../lib/catalogSearch";
import type { CatalogSearchState } from "../../lib/catalogSearch";
import { FlowsIndex } from "./-FlowsPage";

export const Route = createFileRoute("/flows/")({
  validateSearch: (search): CatalogSearchState =>
    parseCatalogSearchState(search, ["skills", "loops", "graphs", "all"], "skills"),
  component: FlowsPage,
});

function FlowsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onNavigate = buildCatalogNavigator(search, (next, replace) => {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace });
  });
  return <FlowsIndex search={search} onNavigate={onNavigate} />;
}
