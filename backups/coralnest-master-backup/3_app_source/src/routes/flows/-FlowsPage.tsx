import { CatalogBrowse, type CatalogTabDef } from "../../components/catalog/CatalogBrowse";
import type { AssetType } from "../../lib/assetTypes";
import type { CatalogSearchState } from "../../lib/catalogSearch";

export const FLOWS_TABS: CatalogTabDef[] = [
  { value: "skills", label: "Skills", mobileLabel: "Skills" },
  { value: "loops", label: "Loops", mobileLabel: "Loops" },
  { value: "graphs", label: "Graphs", mobileLabel: "Graphs" },
  { value: "all", label: "All Flows", mobileLabel: "All" },
];

export function FlowsDetailHref(type: AssetType, slug: string): string {
  switch (type) {
    case "skills":
      return `/skills/${slug}`;
    case "loops":
      return `/loops/${slug}`;
    case "graphs":
      return `/graphs/${slug}`;
    case "mcp_servers":
      return `/mcp/${slug}`;
    case "connectors":
      return `/connectors/${slug}`;
    case "plugins":
      return `/plugins/catalog/${slug}`;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unhandled asset type: ${String(exhaustive)}`);
    }
  }
}

export function FlowsIndex({
  search,
  onNavigate,
}: {
  search: CatalogSearchState;
  onNavigate: (
    updater: (prev: CatalogSearchState) => CatalogSearchState,
    replace?: boolean,
  ) => void;
}) {
  return (
    <CatalogBrowse
      pageType="flows"
      title="Flows"
      subtitle="Agentic skills, feedback loops, and multi-agent graphs from the open catalog."
      tabs={FLOWS_TABS}
      defaultType="skills"
      search={search}
      onNavigate={onNavigate}
      detailHref={FlowsDetailHref}
      searchLabel="Search flows"
      searchPlaceholder="Search skills, loops, and graphs..."
    />
  );
}
