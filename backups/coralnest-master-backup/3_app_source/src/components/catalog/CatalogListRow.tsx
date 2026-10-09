import { Bookmark, Download } from "lucide-react";
import { assetDownloadUrl, rowNumber, rowString, rowStringArray } from "../../lib/assetsClient";
import type { AssetRow, AssetType } from "../../lib/assetTypes";

export function CatalogListRow({
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

  return (
    <a href={detailHref} className="home-v2-listing-row is-catalog">
      {/* col 1: name + owner + tags + summary */}
      <div className="home-v2-listing-row-body">
        <div className="home-v2-listing-row-title">
          <span className="home-v2-listing-row-name">{name}</span>
          {publisher ? <span className="home-v2-listing-row-by">@{publisher}</span> : null}
          {tags.map((t) => (
            <span key={t} className="home-v2-listing-row-tag">
              #{t}
            </span>
          ))}
        </div>
        {summary ? <p className="home-v2-listing-row-summary">{summary}</p> : null}
      </div>

      {/* col 2: category */}
      <div className="home-v2-listing-row-category">{category ?? ""}</div>

      {/* col 3: updated + stars + downloads + download btn */}
      <div className="home-v2-listing-row-stats is-catalog">
        {updatedAt ? (
          <span className="home-v2-listing-row-updated">Updated {timeAgo(updatedAt)}</span>
        ) : null}
        <span className="home-v2-listing-row-counts">
          {stars != null ? (
            <span>
              <Bookmark size={12} aria-hidden="true" />
              {fmt(stars)}
            </span>
          ) : null}
          {downloads != null ? (
            <span>
              <Download size={12} aria-hidden="true" />
              {fmt(downloads)}
            </span>
          ) : null}
          <a
            href={assetDownloadUrl(type, slug)}
            onClick={(e) => e.stopPropagation()}
            className="home-v2-listing-row-download"
            aria-label={`Download ${name}`}
            title="Download"
          >
            <Download size={11} aria-hidden="true" />
          </a>
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
