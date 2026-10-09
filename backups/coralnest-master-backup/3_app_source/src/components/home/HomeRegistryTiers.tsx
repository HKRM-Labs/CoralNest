import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getAssetCountsClient } from "../../lib/assetsClient";
import type { AssetCountsResponse } from "../../lib/assetTypes";
import { formatBrowseCount } from "../../lib/browseCount";

type RegistryTier = {
  name: string;
  logo: string;
  blurb: string;
  href: string;
  count: number | null;
  comingSoon?: boolean;
};

const TIER_ORDER: Array<{
  name: string;
  logo: string;
  blurb: string;
  href: string;
  comingSoon?: boolean;
  countKey: (counts: AssetCountsResponse | null) => number | null;
}> = [
  {
    name: "Flows",
    logo: "/coral-logo-olive.png",
    blurb: "Skills, iterative loops, and multi-agent graph topologies",
    href: "/flows",
    countKey: (counts) => (counts ? counts.skills + counts.loops + counts.graphs : null),
  },
  {
    name: "MCP Servers",
    logo: "/coral-logo-red.png",
    blurb: "Model Context Protocol servers for real-time local tools",
    href: "/mcp",
    countKey: (counts) => (counts ? counts.mcp_servers : null),
  },
  {
    name: "Plugins",
    logo: "/coral-logo-purple.png",
    blurb: "Installable bundles of skills, MCP configs, and CLI helpers",
    href: "/plugins",
    countKey: (counts) => (counts ? counts.plugins : null),
  },
  {
    name: "Connectors",
    logo: "/coral-logo-orange.png",
    blurb: "SaaS integrations, webhook handlers, and auth tunnels",
    href: "/connectors",
    countKey: (counts) => (counts ? counts.connectors : null),
  },
  {
    name: "Personas",
    logo: "/coral-logo-pink.png",
    blurb: "Complete agent archetypes with pre-configured tools",
    href: "/persona",
    comingSoon: true,
    countKey: () => null,
  },
];

export function HomeRegistryTiers() {
  const [counts, setCounts] = useState<AssetCountsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAssetCountsClient()
      .then((result) => {
        if (!cancelled && result) setCounts(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const tiers: RegistryTier[] = TIER_ORDER.map((tier) => ({
    name: tier.name,
    logo: tier.logo,
    blurb: tier.blurb,
    href: tier.href,
    count: tier.countKey(counts),
    comingSoon: tier.comingSoon,
  }));

  return (
    <section aria-label="Registry tiers" className="home-v2-registry-tiers oc-section">
      <div className="registry-tier-grid">
        {tiers.map((tier) => (
          <a
            key={tier.name}
            href={tier.href}
            className="registry-tier-card oc-card oc-card-interactive group flex flex-col gap-3 p-5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <img
                src={tier.logo}
                alt={tier.name}
                className="h-10 w-10 rounded-xl"
                draggable={false}
              />
              <ArrowRight className="registry-tier-arrow h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="registry-tier-name text-sm font-bold">{tier.name}</h2>
              <p className="registry-tier-blurb mt-1 text-xs leading-relaxed">{tier.blurb}</p>
            </div>
            <p className="registry-tier-count mt-auto font-mono text-xs">
              {tier.comingSoon
                ? "Coming soon"
                : tier.count != null
                  ? formatBrowseCount(tier.count)
                  : "—"}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
