import { createFileRoute } from "@tanstack/react-router";
import { CatalogAssetDetail } from "../../components/catalog/CatalogAssetDetail";

export const Route = createFileRoute("/loops/$slug")({
  component: LoopDetailRoute,
});

function LoopDetailRoute() {
  const { slug } = Route.useParams();
  return (
    <CatalogAssetDetail
      type="loops"
      slug={slug}
      backHref={{ to: "/flows?tab=loops", label: "Flows" }}
    />
  );
}
