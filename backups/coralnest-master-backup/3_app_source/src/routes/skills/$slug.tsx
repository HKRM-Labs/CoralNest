import { createFileRoute } from "@tanstack/react-router";
import { CatalogAssetDetail } from "../../components/catalog/CatalogAssetDetail";

export const Route = createFileRoute("/skills/$slug")({
  component: SkillAssetRoute,
});

function SkillAssetRoute() {
  const { slug } = Route.useParams();
  return (
    <CatalogAssetDetail
      type="skills"
      slug={slug}
      backHref={{ to: "/flows?tab=skills", label: "Flows" }}
    />
  );
}
