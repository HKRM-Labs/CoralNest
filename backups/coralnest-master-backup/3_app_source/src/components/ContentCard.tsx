import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { CodeWrapToggleButton, useCodeWrapToggle } from "./CodeWrapToggle";
import { MarkdownPreview } from "./MarkdownPreview";

type ContentCardProps = {
  /** Primary label shown in the header (usually a file name). */
  title: ReactNode;
  /** Secondary label rendered after the title, separated by a dot. */
  meta?: ReactNode;
  /** Renders a "Back" button on the header's left edge when provided. */
  onBack?: () => void;
  backLabel?: string;
  /** Header right slot: download links, copy/wrap buttons. */
  actions?: ReactNode;
  /** Muted footer strip — content hash, storage path, etc. */
  footer?: ReactNode;
  /**
   * Body scroll height. The body always scrolls internally so the surrounding
   * page keeps its own scroll position when a long file is opened.
   */
  height?: "sm" | "md" | "lg";
  /** Removes body padding so full-bleed children (tables, diffs) can breathe. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
};

export function ContentCard({
  title,
  meta,
  onBack,
  backLabel = "Back",
  actions,
  footer,
  height = "md",
  flush = false,
  className,
  children,
}: ContentCardProps) {
  return (
    <section className={cn("content-card", className)} data-height={height}>
      <header className="content-card-head">
        <div className="content-card-head-start">
          {onBack ? (
            <button type="button" onClick={onBack} className="content-card-back">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {backLabel}
            </button>
          ) : null}
        </div>
        <div className="content-card-title">
          <span className="content-card-name">{title}</span>
          {meta ? (
            <>
              <span className="content-card-dot" aria-hidden="true">
                ·
              </span>
              <span className="content-card-meta">{meta}</span>
            </>
          ) : null}
        </div>
        <div className="content-card-actions">{actions}</div>
      </header>

      <div className={cn("content-card-body", flush && "is-flush")}>{children}</div>

      {footer ? <footer className="content-card-foot">{footer}</footer> : null}
    </section>
  );
}

function isMarkdownPath(path: string) {
  return /\.(md|markdown)$/i.test(path);
}

type FileContentCardProps = Omit<ContentCardProps, "children" | "actions"> & {
  /** Raw file text. */
  content: string;
  /** Used to decide between markdown rendering and plain monospace. */
  path?: string;
  /** Force plain monospace even for `.md` paths. */
  raw?: boolean;
  /** Extra actions rendered before the wrap toggle. */
  actions?: ReactNode;
};

/**
 * A ContentCard preset for file text: markdown gets rendered, everything else
 * stays monospace with a line-wrap toggle once the content overflows.
 */
export function FileContentCard({
  content,
  path,
  raw = false,
  actions,
  ...cardProps
}: FileContentCardProps) {
  const { preRef, isWrapped, canWrap, toggleWrap } = useCodeWrapToggle(content);
  const asMarkdown = !raw && path != null && isMarkdownPath(path);

  return (
    <ContentCard
      {...cardProps}
      actions={
        <>
          {actions}
          {!asMarkdown && canWrap ? (
            <CodeWrapToggleButton isWrapped={isWrapped} onToggle={toggleWrap} />
          ) : null}
        </>
      }
    >
      {asMarkdown ? (
        <MarkdownPreview>{content}</MarkdownPreview>
      ) : (
        <pre ref={preRef} className="content-card-pre" data-wrap={isWrapped}>
          {content}
        </pre>
      )}
    </ContentCard>
  );
}
