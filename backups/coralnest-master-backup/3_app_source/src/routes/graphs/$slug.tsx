import { createFileRoute } from "@tanstack/react-router";
import { CatalogAssetDetail } from "../../components/catalog/CatalogAssetDetail";

export const Route = createFileRoute("/graphs/$slug")({
  component: GraphAssetRoute,
});

function GraphAssetRoute() {
  const { slug } = Route.useParams();
  return (
    <CatalogAssetDetail
      type="graphs"
      slug={slug}
      backHref={{ to: "/flows?tab=graphs", label: "Flows" }}
    />
  );
}
