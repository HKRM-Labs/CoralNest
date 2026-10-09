/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const homeCatalogSectionMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component?: unknown }) => {
    const route = {
      __config: config,
    };
    return route;
  },
  Link: ({ children, className, to }: { children: ReactNode; className?: string; to?: string }) => (
    <a className={className} href={to ?? "/"}>
      {children}
    </a>
  ),
}));

vi.mock("../components/home/HomeCatalogSection", () => ({
  HomeCatalogSection: (props: unknown) => {
    homeCatalogSectionMock(props);
    return <section data-testid="home-catalog-stub" />;
  },
}));

vi.mock("../components/HomeAppsSection", () => ({
  HomeAppsSection: () => <section data-testid="home-apps-stub" />,
}));

vi.mock("../components/HomeBringSkillsSection", () => ({
  HomeBringSkillsSection: () => <section data-testid="home-bring-skills-stub" />,
}));

vi.mock("../components/home/HomeRegistryTiers", () => ({
  HomeRegistryTiers: () => <section data-testid="home-tiers-stub" />,
}));

vi.mock("../components/HomeV2FoldBottomFade", () => ({
  HomeV2FoldBottomFade: () => <div data-testid="home-fold-fade-stub" />,
}));

describe("home route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    homeCatalogSectionMock.mockClear();
  });

  async function renderHome() {
    const { Route } = await import("../routes/index");
    const Component = (Route as unknown as { __config: { component: React.ComponentType } })
      .__config.component;

    render(<Component />);
  }

  it("renders the CoralNest hero copy without the community eyebrow", async () => {
    await renderHome();

    expect(screen.queryByText("BUILT BY THE COMMUNITY")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "CoralNest" })).toBeTruthy();
    expect(screen.getByText(/The premier open registry for AI agent flows/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "200k+ publishers" })).toBeNull();
  });

  it("renders the catalog sections for every asset type in canonical order", async () => {
    await renderHome();

    const stubs = screen.getAllByTestId("home-catalog-stub");
    expect(stubs).toHaveLength(6);
    expect(homeCatalogSectionMock.mock.calls.map(([props]) => props.type)).toEqual([
      "skills",
      "loops",
      "graphs",
      "mcp_servers",
      "connectors",
      "plugins",
    ]);
    expect(screen.getByTestId("home-apps-stub").tagName).toBe("SECTION");
    expect(screen.getByTestId("home-bring-skills-stub").tagName).toBe("SECTION");
    expect(screen.getByTestId("home-tiers-stub").tagName).toBe("SECTION");
    expect(screen.queryByPlaceholderText("What are you looking for?")).toBeNull();
  });

  it("does not render the homepage social proof stats strip", async () => {
    await renderHome();

    expect(document.querySelector(".home-v2-proof-bar")).toBeNull();
    expect(screen.queryByText("52.7k")).toBeNull();
    expect(screen.queryByText("180k")).toBeNull();
    expect(screen.queryByText("12M")).toBeNull();
    expect(screen.queryByText("avg rating")).toBeNull();
  });
});
