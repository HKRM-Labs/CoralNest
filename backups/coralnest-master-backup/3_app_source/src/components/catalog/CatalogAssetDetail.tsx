import {
  ArrowLeft,
  Bookmark,
  Check,
  Copy,
  Download,
  File,
  FileText,
  Folder,
  PackageSearch,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assetDownloadUrl,
  assetFileUrl,
  getAssetDetailClient,
  getAssetPayloadClient,
  getAssetTreeClient,
  parsePayloadJson,
  rowNumber,
  rowString,
  rowStringArray,
} from "../../lib/assetsClient";
import type {
  AssetDetailResponse,
  AssetPayloadResponse,
  AssetTreeFile,
  AssetType,
} from "../../lib/assetTypes";
import { ContentCard, FileContentCard } from "../ContentCard";
import { CoralPageWrapper } from "../CoralPageWrapper";
import { MarkdownPreview } from "../MarkdownPreview";
import { assetTypeMeta } from "./CatalogCard";

type DetailField = { key: string; label: string };
type Tab = "readme" | "files" | "payload";

const DETAIL_FIELDS: Record<AssetType, DetailField[]> = {
  skills: [
    { key: "publisher", label: "Publisher" },
    { key: "category", label: "Category" },
    { key: "subcategory", label: "Subcategory" },
    { key: "language", label: "Language" },
    { key: "version", label: "Version" },
    { key: "license", label: "License" },
    { key: "source_repo", label: "Source Repo" },
    { key: "difficulty", label: "Difficulty" },
  ],
  plugins: [
    { key: "publisher", label: "Publisher" },
    { key: "category", label: "Category" },
    { key: "subcategory", label: "Subcategory" },
    { key: "version", label: "Version" },
    { key: "license", label: "License" },
    { key: "source_repo", label: "Source Repo" },
    { key: "plugin_type", label: "Plugin Type" },
  ],
  mcp_servers: [
    { key: "namespace", label: "Namespace" },
    { key: "transport", label: "Transport" },
    { key: "hosting", label: "Hosting" },
    { key: "tools_count", label: "Tools" },
    { key: "env_vars_count", label: "Env Vars" },
    { key: "license", label: "License" },
    { key: "source_repo", label: "Source Repo" },
  ],
  connectors: [
    { key: "provider", label: "Provider" },
    { key: "auth_type", label: "Auth Type" },
    { key: "actions_count", label: "Actions" },
    { key: "triggers_count", label: "Triggers" },
    { key: "webhooks_count", label: "Webhooks" },
    { key: "category", label: "Category" },
    { key: "subcategory", label: "Subcategory" },
  ],
  loops: [
    { key: "loop_kind", label: "Loop Kind" },
    { key: "category", label: "Category" },
    { key: "difficulty", label: "Difficulty" },
    { key: "max_iterations", label: "Max Iterations" },
    { key: "step_count", label: "Steps" },
    { key: "convergence_strategy", label: "Convergence" },
  ],
  graphs: [
    { key: "graph_type", label: "Graph Type" },
    { key: "framework", label: "Framework" },
    { key: "node_count", label: "Nodes" },
    { key: "edge_count", label: "Edges" },
    { key: "supports_streaming", label: "Streaming" },
    { key: "supports_human_in_loop", label: "Human-in-loop" },
    { key: "license", label: "License" },
  ],
};

function fmtVal(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string" && v) return v;
  if (typeof v === "number") return String(v);
  return "";
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function isText(p: string) {
  return /\.(md|markdown|json|txt|yml|yaml|py|ts|tsx|js|jsx|toml|env|sh|lock)$/i.test(p);
}

function tryJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

type TreeNode = { name: string; path: string; isDir: boolean; size?: number; children: TreeNode[] };

function buildTree(files: AssetTreeFile[]): TreeNode[] {
  const nodes: TreeNode[] = [];
  const map = new Map<string, TreeNode>();
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    if (!parts.length) continue;
    let cur = nodes;
    let cp = "";
    parts.forEach((p, i) => {
      const full = cp ? `${cp}/${p}` : p;
      const last = i === parts.length - 1;
      let node = map.get(full);
      if (!node) {
        node = last
          ? { name: p, path: f.path, isDir: false, size: f.size, children: [] }
          : { name: p, path: full, isDir: true, children: [] };
        map.set(full, node);
      }
      if (!cur.find((n) => n === node)) cur.push(node);
      cur = node.isDir ? node.children : [];
      cp = full;
    });
  }
  const sort = (list: TreeNode[]) => {
    list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    list.forEach((n) => n.isDir && sort(n.children));
  };
  sort(nodes);
  return nodes;
}

function FileTree({
  nodes,
  depth = 0,
  type,
  slug,
  onPreview,
  previewPath,
}: {
  nodes: TreeNode[];
  depth?: number;
  type: AssetType;
  slug: string;
  onPreview: (p: string) => void;
  previewPath: string | null;
}) {
  return (
    <ul
      className={depth > 0 ? "mt-1 ml-4 space-y-0.5 border-l border-slate-800 pl-3" : "space-y-0.5"}
    >
      {nodes.map((n) => (
        <li key={n.path}>
          {n.isDir ? (
            <div className="flex items-center gap-2 py-0.5 text-xs font-semibold text-slate-400">
              <Folder className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" /> {n.name}/
            </div>
          ) : (
            <div className="group flex items-center gap-2 py-0.5 text-xs">
              {isText(n.path) ? (
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
              ) : (
                <File className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => onPreview(n.path)}
                className={`truncate font-mono transition-colors ${previewPath === n.path ? "text-slate-200" : "text-slate-400 hover:text-white"}`}
              >
                {n.name}
              </button>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-600">
                {n.size != null ? fmtBytes(n.size) : ""}
              </span>
              <a
                href={assetFileUrl(type, slug, n.path)}
                download
                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                aria-label={`Download ${n.name}`}
              >
                <Download className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          )}
          {n.isDir && (
            <FileTree
              nodes={n.children}
              depth={depth + 1}
              type={type}
              slug={slug}
              onPreview={onPreview}
              previewPath={previewPath}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function PayloadPanel({ type, slug }: { type: AssetType; slug: string }) {
  const [payload, setPayload] = useState<AssetPayloadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getAssetPayloadClient(type, slug).then((r) => {
      if (!cancelled) {
        setPayload(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [type, slug]);
  const json = useMemo(() => {
    if (!payload) return null;
    const p = parsePayloadJson(payload);
    return p != null ? JSON.stringify(p, null, 2) : payload.content;
  }, [payload]);
  const copy = () => {
    if (!json) return;
    void navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  if (loading) return <div className="h-32 animate-pulse rounded-lg bg-slate-900" />;
  if (!payload || !json) return <p className="text-sm text-slate-500">No payload available.</p>;
  return (
    <FileContentCard
      title={payload.fileName}
      meta={fmtBytes(new Blob([json]).size)}
      content={json}
      raw
      footer={payload.storagePath}
      actions={
        <button type="button" onClick={copy} className="content-card-action">
          {copied ? (
            <>
              <Check className="h-3 w-3" aria-hidden="true" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" aria-hidden="true" /> Copy
            </>
          )}
        </button>
      }
    />
  );
}

export function CatalogAssetDetail({
  type,
  slug,
  backHref,
}: {
  type: AssetType;
  slug: string;
  backHref: { to: string; label: string };
}) {
  const { label, icon: Icon } = assetTypeMeta(type);
  const [detail, setDetail] = useState<AssetDetailResponse | null>(null);
  const [treeFiles, setTreeFiles] = useState<AssetTreeFile[]>([]);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("readme");
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setDetail(null);
    setTreeFiles([]);
    setStoragePath(null);
    setPreviewPath(null);
    setPreviewContent(null);
    void Promise.allSettled([
      getAssetDetailClient(type, slug),
      getAssetTreeClient(type, slug),
    ]).then(([dr, tr]) => {
      if (cancelled) return;
      if (dr.status === "rejected" || !dr.value) {
        setError(true);
        setLoading(false);
        return;
      }
      setDetail(dr.value);
      if (tr.status === "fulfilled" && tr.value) {
        setTreeFiles(tr.value.files);
        setStoragePath(tr.value.storagePath ?? null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [type, slug]);

  const item = detail?.item ?? null;
  const readme = detail?.readme ?? null;
  const name = item ? (rowString(item, "name") ?? slug) : slug;
  const summary = item ? rowString(item, "summary") : undefined;
  const publisher = item
    ? (rowString(item, "publisher") ?? rowString(item, "namespace"))
    : undefined;
  const category = item ? rowString(item, "category") : undefined;
  const quality = item ? rowNumber(item, "quality_score") : undefined;
  const security = item ? rowNumber(item, "security_score") : undefined;
  const stars = item ? rowNumber(item, "stars") : undefined;
  const downloads = item ? rowNumber(item, "downloads") : undefined;
  const version = item
    ? (rowString(item, "version") ?? rowString(item, "github_current_commit")?.slice(0, 7))
    : undefined;
  const license = item ? rowString(item, "license") : undefined;
  const updatedAt = item
    ? (rowString(item, "updated_at") ?? rowString(item, "created_at"))
    : undefined;
  const tags = item ? rowStringArray(item, "tags") : [];
  const runCommand = item ? rowString(item, "command") : undefined;
  const rowSP =
    storagePath ??
    (item ? (rowString(item, "storage_path") ?? rowString(item, "storage_url")) : null);
  const payloadFileName = rowSP?.split("/").pop() ?? "asset.json";
  const treeNodes = useMemo(() => buildTree(treeFiles), [treeFiles]);

  const handlePreview = useCallback(
    async (path: string) => {
      if (previewPath === path) {
        setPreviewPath(null);
        setPreviewContent(null);
        return;
      }
      setPreviewPath(path);
      setPreviewContent(null);
      setPreviewLoading(true);
      try {
        const res = await fetch(assetFileUrl(type, slug, path));
        if (!res.ok) {
          setPreviewContent(`Unable to load "${path}".`);
          return;
        }
        const text = await res.text();
        setPreviewContent(path.toLowerCase().endsWith(".json") ? tryJson(text) : text);
      } catch {
        setPreviewContent(`Unable to load "${path}".`);
      } finally {
        setPreviewLoading(false);
      }
    },
    [previewPath, type, slug],
  );

  const closePreview = useCallback(() => {
    setPreviewPath(null);
    setPreviewContent(null);
  }, []);

  const previewSize = previewPath ? treeFiles.find((f) => f.path === previewPath)?.size : undefined;

  const copyCmd = () => {
    if (!runCommand) return;
    void navigator.clipboard.writeText(runCommand);
    setCopiedCmd(true);
    window.setTimeout(() => setCopiedCmd(false), 2000);
  };

  const tabs: { id: Tab; label: string }[] = [
    ...(readme ? [{ id: "readme" as Tab, label: "README" }] : []),
    ...(treeFiles.length > 0 ? [{ id: "files" as Tab, label: "Files" }] : []),
    { id: "payload" as Tab, label: payloadFileName },
  ];
  // Default to first available tab
  const defaultTab = readme ? "readme" : treeFiles.length > 0 ? "files" : "payload";
  const activeTab = tabs.find((t) => t.id === tab)?.id ?? defaultTab;

  return (
    <CoralPageWrapper>
      <div className="skill-detail-page mx-auto max-w-300 px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-4">
            <div className="h-5 w-24 animate-pulse rounded bg-slate-800/60" />
            <div className="h-8 w-64 animate-pulse rounded bg-slate-800/60" />
            <div className="h-20 animate-pulse rounded bg-slate-800/50" />
          </div>
        ) : error || !item ? (
          <div className="py-16 text-center">
            <PackageSearch className="mx-auto mb-4 h-12 w-12 text-slate-700" aria-hidden="true" />
            <h2 className="text-xl font-bold text-white">{label} not found</h2>
            <p className="mt-2 text-sm text-slate-500">
              The requested {label.toLowerCase()} could not be located.
            </p>
            <a
              href={backHref.to}
              className="mt-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> {backHref.label}
            </a>
          </div>
        ) : (
          <div className="skill-detail-stack">
            <div className="skill-hero">
              <div className="skill-hero-top">
                <div className="skill-hero-layout has-sidebar">
                  {/* ── HERO MAIN: breadcrumb, title, summary, creator ── */}
                  <div className="skill-hero-main">
                    <div className="skill-hero-taxonomy-row">
                      <a href={backHref.to} className="inline-flex items-center gap-1">
                        <ArrowLeft className="h-3.5 w-3.5" /> {backHref.label}
                      </a>
                      {category ? (
                        <>
                          <span className="skill-hero-taxonomy-separator">/</span>
                          <span className="inline-flex items-center gap-1">
                            <Icon className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                            {category}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="skill-hero-title">
                      <div className="skill-hero-heading-stack">
                        <div className="skill-hero-title-row">
                          <h1 className="skill-page-title">{name}</h1>
                        </div>
                      </div>

                      {summary ? (
                        <div className="skill-summary-block">
                          <p className="section-subtitle skill-summary-line">{summary}</p>
                        </div>
                      ) : null}

                      {tags.length > 0 ? (
                        <div className="skill-hero-badges">
                          {tags.map((t) => (
                            <span key={t} className="skill-hero-taxonomy-prefix">
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {publisher ? (
                      <div className="skill-hero-creator">
                        <span className="user-badge user-badge-md">
                          <span className="user-avatar">{publisher.slice(0, 1).toUpperCase()}</span>
                          <span className="user-handle">@{publisher}</span>
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* ── LOWER: install + tabs on the left, meta sidebar on the right ── */}
                  <div className="skill-hero-lower has-sidebar">
                    <div className="skill-hero-main-extra">
                      {/* install / run command */}
                      {runCommand ? (
                        <div className="skill-install-command-card">
                          <div className="skill-install-command-header detail-hero-summary-row">
                            <span className="skill-sidebar-label">Install</span>
                          </div>
                          <div className="skill-install-command-wrap">
                            <div className="skill-install-command-shell skill-install-command-shell-cli">
                              <span className="select-none opacity-50">$</span>
                              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
                                {runCommand}
                              </code>
                              <button
                                type="button"
                                onClick={copyCmd}
                                className="skill-install-command-inline-button shrink-0 rounded p-1"
                                aria-label="Copy command"
                              >
                                {copiedCmd ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* download button */}
                      <div>
                        <a
                          href={assetDownloadUrl(type, slug)}
                          className="oc-action-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
                        >
                          <Download className="h-4 w-4" /> Download {payloadFileName}
                        </a>
                      </div>

                      {/* stats */}
                      {stars != null || downloads != null || quality != null ? (
                        <div className="skill-hero-meta-row">
                          {quality != null ? (
                            <span className="skill-hero-meta-item">Q {quality}/100</span>
                          ) : null}
                          {security != null ? (
                            <span className="skill-hero-meta-item">Sec {security}/100</span>
                          ) : null}
                          {stars != null ? (
                            <span className="skill-hero-meta-item inline-flex items-center gap-1">
                              <Bookmark size={13} className="opacity-50" />
                              {stars.toLocaleString()}
                            </span>
                          ) : null}
                          {downloads != null ? (
                            <span className="skill-hero-meta-item inline-flex items-center gap-1">
                              <Download size={13} className="opacity-50" />
                              {downloads.toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {/* tab card */}
                      <div className="tab-card skill-detail-tabs-card">
                        {tabs.length > 0 ? (
                          <div className="tab-header" role="tablist" aria-label="Content sections">
                            {tabs.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === t.id}
                                onClick={() => setTab(t.id)}
                                className={`tab-button${activeTab === t.id ? " is-active" : ""}`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {/* tab content */}
                        <div className="tab-body skill-readme-body">
                          {activeTab === "readme" && readme ? (
                            <ContentCard
                              title="README.md"
                              meta={fmtBytes(readme.length)}
                              height="lg"
                            >
                              <MarkdownPreview>{readme}</MarkdownPreview>
                            </ContentCard>
                          ) : activeTab === "files" && treeFiles.length > 0 ? (
                            previewLoading ? (
                              <div className="h-64 animate-pulse rounded-lg bg-slate-950" />
                            ) : previewPath && previewContent != null ? (
                              <FileContentCard
                                title={previewPath.split("/").pop() ?? previewPath}
                                meta={previewSize != null ? fmtBytes(previewSize) : undefined}
                                path={previewPath}
                                content={previewContent}
                                height="lg"
                                onBack={closePreview}
                                footer={previewPath}
                                actions={
                                  <a
                                    href={assetFileUrl(type, slug, previewPath)}
                                    download
                                    className="content-card-action"
                                    aria-label={`Download ${previewPath}`}
                                  >
                                    <Download className="h-3 w-3" aria-hidden="true" />
                                  </a>
                                }
                              />
                            ) : (
                              <ContentCard
                                title="Files"
                                meta={`${treeFiles.length} file${treeFiles.length === 1 ? "" : "s"}`}
                                height="lg"
                                footer={rowSP ?? undefined}
                              >
                                <FileTree
                                  nodes={treeNodes}
                                  type={type}
                                  slug={slug}
                                  onPreview={handlePreview}
                                  previewPath={previewPath}
                                />
                              </ContentCard>
                            )
                          ) : activeTab === "payload" ? (
                            <PayloadPanel type={type} slug={slug} />
                          ) : (
                            <p className="text-sm text-slate-500">No content available.</p>
                          )}
                        </div>
                      </div>
                      {/* end tab-card */}
                    </div>
                    {/* end skill-hero-main-extra */}

                    {/* ── SIDEBAR: stats, metadata, download ── */}
                    <aside className="skill-hero-sidebar">
                      <div className="skill-hero-sidebar-stack">
                        {/* headline stats */}
                        {downloads != null ||
                        stars != null ||
                        quality != null ||
                        security != null ? (
                          <div className="skill-hero-sidebar-meta">
                            {stars != null ? (
                              <div className="skill-sidebar-item">
                                <span className="skill-sidebar-label">Bookmarks</span>
                                <span className="skill-sidebar-value">
                                  {stars.toLocaleString()}
                                </span>
                              </div>
                            ) : null}
                            {downloads != null ? (
                              <div className="skill-sidebar-item">
                                <span className="skill-sidebar-label">Downloads</span>
                                <span className="skill-sidebar-value">
                                  {downloads.toLocaleString()}
                                </span>
                              </div>
                            ) : null}
                            {quality != null ? (
                              <div className="skill-sidebar-item">
                                <span className="skill-sidebar-label">Quality</span>
                                <span className="skill-sidebar-value">{quality}/100</span>
                              </div>
                            ) : null}
                            {security != null ? (
                              <div className="skill-sidebar-item">
                                <span className="skill-sidebar-label">Security audit</span>
                                <span className="skill-sidebar-value">{security}/100</span>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {/* metadata */}
                        <div className="skill-hero-sidebar-meta">
                          {DETAIL_FIELDS[type]
                            .filter((f) => {
                              const v = item[f.key];
                              return v !== undefined && v !== null && v !== "";
                            })
                            .map((f) => (
                              <div key={f.key} className="skill-sidebar-item">
                                <span className="skill-sidebar-label">{f.label}</span>
                                <span className="skill-sidebar-value break-all">
                                  {fmtVal(item[f.key])}
                                </span>
                              </div>
                            ))}
                          {updatedAt ? (
                            <div className="skill-sidebar-item">
                              <span className="skill-sidebar-label">Last updated</span>
                              <span className="skill-sidebar-value">{updatedAt}</span>
                            </div>
                          ) : null}
                          {version ? (
                            <div className="skill-sidebar-item">
                              <span className="skill-sidebar-label">Current version</span>
                              <span className="skill-sidebar-value break-all">{version}</span>
                            </div>
                          ) : null}
                          {license ? (
                            <div className="skill-sidebar-item">
                              <span className="skill-sidebar-label">License</span>
                              <span className="skill-sidebar-value">{license}</span>
                            </div>
                          ) : null}
                        </div>

                        {/* download */}
                        <a
                          href={assetDownloadUrl(type, slug)}
                          className="oc-action-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
                        >
                          <Download className="h-4 w-4" /> Download {payloadFileName}
                        </a>
                      </div>
                    </aside>
                  </div>
                  {/* end skill-hero-lower */}
                </div>
                {/* end skill-hero-layout */}
              </div>
              {/* end skill-hero-top */}
            </div>
            {/* end skill-hero */}
          </div>
        )}
      </div>
    </CoralPageWrapper>
  );
}
