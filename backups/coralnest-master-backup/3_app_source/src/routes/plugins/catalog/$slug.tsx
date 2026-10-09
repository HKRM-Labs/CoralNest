import { createFileRoute } from "@tanstack/react-router";
import { CatalogAssetDetail } from "../../../components/catalog/CatalogAssetDetail";

export const Route = createFileRoute("/plugins/catalog/$slug")({
  component: PluginCatalogAssetRoute,
});

function PluginCatalogAssetRoute() {
  const { slug } = Route.useParams();
  return (
    <CatalogAssetDetail
      type="plugins"
      slug={slug}
      backHref={{ to: "/plugins", label: "Plugins" }}
    />
  );
}
