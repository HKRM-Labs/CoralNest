import { createFileRoute } from "@tanstack/react-router";
import { CatalogAssetDetail } from "../../components/catalog/CatalogAssetDetail";

export const Route = createFileRoute("/connectors/$slug")({
  component: ConnectorAssetRoute,
});

function ConnectorAssetRoute() {
  const { slug } = Route.useParams();
  return (
    <CatalogAssetDetail
      type="connectors"
      slug={slug}
      backHref={{ to: "/connectors", label: "Connectors" }}
    />
  );
}
