import { Bookmark, Boxes, Cable, Download, Network, Plug, Repeat2, Sparkles } from "lucide-react";
import { rowNumber, rowString, rowStringArray } from "../../lib/assetsClient";
import type { AssetRow, AssetType } from "../../lib/assetTypes";

const TYPE_META: Record<AssetType, { label: string; icon: typeof Sparkles }> = {
  skills: { label: "Skill", icon: Sparkles },
  plugins: { label: "Plugin", icon: Plug },
  mcp_servers: { label: "MCP Server", icon: Cable },
  connectors: { label: "Connector", icon: Boxes },
  loops: { label: "Loop", icon: Repeat2 },
  graphs: { label: "Graph", icon: Network },
};

export function assetTypeMeta(type: AssetType) {
  return TYPE_META[type];
}

export function CatalogCard({
  item,
  type,
  detailHref,
}: {
  item: AssetRow;
  type: AssetType;
  detailHref: string;
}) {
  const slug = rowString(item, "slug") ?? "";
  const name = rowString(item, "name") ?? slug;
  const publisher = rowString(item, "publisher") ?? rowString(item, "namespace");
  const summary = rowString(item, "summary");
  const tags = rowStringArray(item, "tags").slice(0, 3);
  const category = rowString(item, "category");
  const stars = rowNumber(item, "stars");
  const downloads = rowNumber(item, "downloads");
  const updatedAt = rowString(item, "updated_at") ?? rowString(item, "created_at");

  const TypeIcon = TYPE_META[type].icon;

  return (
    <a
      href={detailHref}
      className="catalog-card oc-card oc-card-interactive group flex min-h-40 flex-col gap-0 p-4 transition-colors"
    >
      {/* header: name + owner */}
      <div className="mb-2">
        <h3 className="catalog-card-name text-[15px] font-bold leading-snug tracking-tight">
          {name}
        </h3>
        {publisher ? <p className="catalog-card-by mt-0.5 text-[12px]">@{publisher}</p> : null}
      </div>

      {/* description */}
      {summary ? (
        <p className="catalog-card-summary line-clamp-3 text-[13px] leading-relaxed">{summary}</p>
      ) : null}

      {/* category + tags */}
      {category || tags.length > 0 ? (
        <div className="catalog-card-meta mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          {category ? (
            <span className="inline-flex items-center gap-1">
              <TypeIcon size={12} className="opacity-60" aria-hidden="true" />
              {category}
            </span>
          ) : null}
          {tags.map((t) => (
            <span key={t} className="catalog-card-tag">
              #{t}
            </span>
          ))}
        </div>
      ) : null}

      {/* footer */}
      <div className="catalog-card-footer mt-auto flex items-center justify-between pt-2.5 text-[12px]">
        <span>{updatedAt ? `Updated ${timeAgo(updatedAt)}` : ""}</span>
        <span className="flex items-center gap-3">
          {stars != null ? (
            <span className="inline-flex items-center gap-1">
              <Bookmark size={12} className="opacity-60" aria-hidden="true" />
              {fmt(stars)}
            </span>
          ) : null}
          {downloads != null ? (
            <span className="inline-flex items-center gap-1">
              <Download size={12} className="opacity-60" aria-hidden="true" />
              {fmt(downloads)}
            </span>
          ) : null}
        </span>
      </div>
    </a>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w ago`;
  const mos = Math.floor(days / 30);
  if (mos < 12) return `${mos}mo ago`;
  return `${Math.floor(mos / 12)}y ago`;
}
