/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowsDetailHref, FlowsIndex } from "../routes/flows/-FlowsPage";
import { Route as FlowsRoute } from "../routes/flows/index";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: unknown; validateSearch: unknown }) => ({
    __config: config,
    useNavigate: () => navigateMock,
    useSearch: () => ({ tab: "skills" }),
  }),
  useRouterState: (options: { select: (state: unknown) => unknown }) =>
    options.select({ location: { searchStr: "" } }),
  redirect: (options: unknown) => ({ redirect: options }),
  Link: (props: { children: ReactNode }) => <a href="/">{props.children}</a>,
}));

vi.mock("../components/CoralPageWrapper", () => ({
  CoralPageWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/skeletons/BrowseResultsSkeleton", () => ({
  BrowseResultsSkeleton: () => <div data-testid="skeleton" />,
}));

const mockNavigate = (
  updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  replace?: boolean,
) => navigateMock({ search: updater, replace });

function renderFlows() {
  render(
    <FlowsIndex
      search={{ tab: "skills" }}
      onNavigate={(updater, replace) => {
        const next = updater({ tab: "skills" });
        mockNavigate((prev) => ({ ...prev, ...next }), replace);
      }}
    />,
  );
}

describe("FlowsIndex", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("validates and normalizes top-level flow tabs", () => {
    const validateSearch = (
      FlowsRoute as unknown as {
        __config: {
          validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
        };
      }
    ).__config.validateSearch;

    expect(validateSearch({ tab: "loops" })).toEqual(expect.objectContaining({ tab: "loops" }));
    expect(validateSearch({ tab: "graphs" })).toEqual(expect.objectContaining({ tab: "graphs" }));
    expect(validateSearch({ tab: "all" })).toEqual(expect.objectContaining({ tab: "all" }));
    expect(validateSearch({ tab: "skills" })).toEqual(expect.objectContaining({ tab: "skills" }));
    expect(validateSearch({})).toEqual(expect.objectContaining({ tab: "skills" }));
  });

  it("renders top-level tabs for Skills, Loops, Graphs, and All Flows", () => {
    renderFlows();

    expect(screen.getByRole("radio", { name: "Skills" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Loops" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Graphs" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "All Flows" })).toBeTruthy();
  });

  it("switches to Loops tab when Loops is clicked", () => {
    renderFlows();

    const loopsTab = screen.getByRole("radio", { name: "Loops" });
    fireEvent.click(loopsTab);

    expect(navigateMock).toHaveBeenCalled();
    const nextSearch = navigateMock.mock.calls[0][0].search({ tab: "skills" });
    expect(nextSearch.tab).toBe("loops");
    expect(navigateMock.mock.calls[0][0].replace).toBe(true);
  });

  it("switches to All Flows tab when All Flows is clicked", () => {
    renderFlows();

    const allTab = screen.getByRole("radio", { name: "All Flows" });
    fireEvent.click(allTab);

    expect(navigateMock).toHaveBeenCalled();
    const nextSearch = navigateMock.mock.calls[0][0].search({ tab: "skills" });
    expect(nextSearch.tab).toBe("all");
  });

  it("maps catalog types to detail routes", () => {
    expect(FlowsDetailHref("skills", "a")).toBe("/skills/a");
    expect(FlowsDetailHref("loops", "b")).toBe("/loops/b");
    expect(FlowsDetailHref("graphs", "c")).toBe("/graphs/c");
    expect(FlowsDetailHref("mcp_servers", "d")).toBe("/mcp/d");
    expect(FlowsDetailHref("connectors", "e")).toBe("/connectors/e");
    expect(FlowsDetailHref("plugins", "f")).toBe("/plugins/catalog/f");
  });
});
