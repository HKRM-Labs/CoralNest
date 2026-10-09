import { createFileRoute } from "@tanstack/react-router";
import { CoralPageWrapper } from "../components/CoralPageWrapper";
import { HomeCatalogSection } from "../components/home/HomeCatalogSection";
import { HomeRegistryTiers } from "../components/home/HomeRegistryTiers";
import { HomeAppsSection } from "../components/HomeAppsSection";
import { HomeBringSkillsSection } from "../components/HomeBringSkillsSection";
import { HomeV2FoldBottomFade } from "../components/HomeV2FoldBottomFade";

const CATALOG_SECTIONS = [
  {
    type: "skills",
    title: "Top skills",
    subtitle: "Atomic prompts, role guides, and reference workflows",
  },
  {
    type: "loops",
    title: "Popular loops",
    subtitle: "Iterative, closed-loop execution recipes",
  },
  {
    type: "graphs",
    title: "Featured graphs",
    subtitle: "Stateful multi-agent topologies and routing logic",
  },
  {
    type: "mcp_servers",
    title: "Top MCP servers",
    subtitle: "Real-time local tools, databases, and filesystem servers",
  },
  {
    type: "connectors",
    title: "Popular connectors",
    subtitle: "SaaS integrations with authenticated credentials and webhooks",
  },
  {
    type: "plugins",
    title: "Top plugins",
    subtitle: "Installable bundles of skills, MCP configs, and CLI helpers",
  },
] as const;

const FREELANCER_ANALOGY = [
  { concept: "Knowledge & Skillset", tier: "Skills" },
  { concept: "Work Methodology & Process", tier: "Loops & Graphs" },
  { concept: "Hardware & Local Toolbelt", tier: "MCP Servers" },
  { concept: "Client Passwords & SaaS Access", tier: "Connectors" },
  { concept: "Pre-Packaged Toolkit", tier: "Plugins" },
  { concept: "The Complete Specialist You Hire", tier: "Personas" },
] as const;

export const Route = createFileRoute("/")({
  component: CatalogHome,
});

function CatalogHome() {
  return (
    <CoralPageWrapper pageType="home">
      <main className="home-v2-main oc-app-surface">
        <HomeV2FoldBottomFade />

        {/* ═══ HERO ═══ */}
        <section className="home-v2-hero oc-hero">
          <div className="home-v2-hero-bg" aria-hidden="true" />

          <img
            src="/coral-logo.png"
            alt="CoralNest"
            className="home-v2-hero-logo"
            draggable={false}
          />

          <h1 className="home-v2-headline oc-hero-title">
            <span className="home-v2-action-word home-v2-static-headline">CoralNest</span>
          </h1>

          <p className="home-v2-sub oc-hero-lede">
            The premier open registry for AI agent flows, MCP servers, plugins, connectors, and
            personas
          </p>
        </section>

        <HomeRegistryTiers />

        {/* ═══ CATALOG LISTINGS — one full-width section per asset type ═══ */}
        <div className="home-v2-listing-stack">
          {CATALOG_SECTIONS.map((section) => (
            <HomeCatalogSection
              key={section.type}
              type={section.type}
              title={section.title}
              subtitle={section.subtitle}
              limit={6}
            />
          ))}
        </div>

        {/* ═══ FREELANCER ANALOGY TABLE ═══ */}
        <section className="home-v2-analogy oc-section">
          <table aria-label="Freelancer analogy" className="w-full border-collapse text-sm">
            <thead>
              <tr className="home-v2-analogy-headrow">
                <th className="home-v2-analogy-th py-3 pr-6 text-left font-semibold">
                  When a freelancer has…
                </th>
                <th className="home-v2-analogy-th py-3 text-left font-semibold">
                  CoralNest calls it…
                </th>
              </tr>
            </thead>
            <tbody>
              {FREELANCER_ANALOGY.map((row) => (
                <tr key={row.concept} className="home-v2-analogy-row">
                  <td className="home-v2-analogy-concept py-3 pr-6">{row.concept}</td>
                  <td className="home-v2-analogy-tier py-3 font-medium">{row.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <HomeAppsSection />
        <HomeBringSkillsSection />
      </main>
    </CoralPageWrapper>
  );
}

export default CatalogHome;
