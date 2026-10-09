import { createFileRoute } from "@tanstack/react-router";
import { CatalogAssetDetail } from "../../components/catalog/CatalogAssetDetail";

export const Route = createFileRoute("/mcp/$slug")({
  component: McpAssetRoute,
});

function McpAssetRoute() {
  const { slug } = Route.useParams();
  return (
    <CatalogAssetDetail type="mcp_servers" slug={slug} backHref={{ to: "/mcp", label: "MCP" }} />
  );
}
