/**
 * Bug Condition Exploration Test — Task 1
 *
 * **Validates: Requirements 1.1, 2.1, 2.2, 2.6, 2.7**
 *
 * This test MUST FAIL on unfixed code.
 * Failure confirms the bugs exist:
 *   - `src/lib/tierTheme.ts` does not exist (import fails → module not found)
 *   - CoralPageWrapper returns "/coral-logo-purple.png" for flows, mcp, connectors, creators
 *   - HomeCatalogSection uses hardcoded "text-teal-400" for all asset types
 *   - CatalogAssetDetail uses a single hardcoded teal DETAIL_THEME for all asset types
 *
 * DO NOT fix the test or the implementation when this test fails.
 * The failure output IS the counterexample evidence.
 *
 * After the fix is implemented (Task 3.1), this test will pass and serve as
 * the regression guard for the three bug condition families.
 *
 * Scoped PBT Approach: deterministic exhaustive checks over small finite sets.
 * No random generation is needed — "for all X in known set, assert P(X)".
 */

import { describe, expect, it } from "vitest";
import { DETAIL_THEMES, PAGE_TYPE_TO_TIER, TIER_LINK_COLOR, TIER_LOGO } from "../lib/tierTheme";

// ---------------------------------------------------------------------------
// Known finite input sets (from design.md / bugfix.md)
// ---------------------------------------------------------------------------

/** All pageType values that must map to a defined TIER_LOGO. */
const ALL_PAGE_TYPES = [
  "flows",
  "skills",
  "mcp",
  "plugins",
  "connectors",
  "creators",
  "persona",
  "home",
] as const;

/**
 * Page types for which the bug manifests: they were ALL returning
 * "/coral-logo-purple.png" instead of their correct per-tier logo.
 */
const BUGGY_PAGE_TYPES = ["flows", "mcp", "connectors", "creators"] as const;

/** All AssetType discriminator values used in HomeCatalogSection and CatalogAssetDetail. */
const ALL_ASSET_TYPES = [
  "skills",
  "loops",
  "graphs",
  "mcp_servers",
  "plugins",
  "connectors",
] as const;

// ---------------------------------------------------------------------------
// Property 1: Per-Tier Logo Mapping
// Validates: Requirements 2.1, 2.2, 2.6, 2.7
// ---------------------------------------------------------------------------

describe("TIER_LOGO — per-tier logo mapping", () => {
  it("resolves every pageType in PAGE_TYPE_TO_TIER to a defined TIER_LOGO entry", () => {
    for (const pageType of ALL_PAGE_TYPES) {
      const tier = PAGE_TYPE_TO_TIER[pageType];
      expect(tier, `PAGE_TYPE_TO_TIER["${pageType}"] should be defined`).toBeDefined();

      const logo = TIER_LOGO[tier];
      expect(
        logo,
        `TIER_LOGO[PAGE_TYPE_TO_TIER["${pageType}"]] (tier="${tier}") should be defined`,
      ).toBeDefined();
    }
  });

  it('returns correct per-tier logo — NOT "/coral-logo-purple.png" — for buggy page types', () => {
    /**
     * Bug: CoralPageWrapper.getCoralLogoSrc() returns "/coral-logo-purple.png"
     * for every case including flows, mcp, connectors, creators.
     *
     * Expected mappings (from design.md):
     *   flows      → "/coral-logo-olive.png"
     *   mcp        → "/coral-logo-red.png"
     *   connectors → "/coral-logo-orange.png"
     *   creators   → "/coral-logo-pink.png"
     *
     * Counterexamples on unfixed code:
     *   getCoralLogoSrc("flows")      → "/coral-logo-purple.png"  ✗  (should be "-olive.png")
     *   getCoralLogoSrc("mcp")        → "/coral-logo-purple.png"  ✗  (should be "-red.png")
     *   getCoralLogoSrc("connectors") → "/coral-logo-purple.png"  ✗  (should be "-orange.png")
     *   getCoralLogoSrc("creators")   → "/coral-logo-purple.png"  ✗  (should be "-pink.png")
     */
    for (const pageType of BUGGY_PAGE_TYPES) {
      const tier = PAGE_TYPE_TO_TIER[pageType];
      const logo = TIER_LOGO[tier];

      expect(
        logo,
        `TIER_LOGO for pageType="${pageType}" (tier="${tier}") must NOT be "/coral-logo-purple.png"`,
      ).not.toBe("/coral-logo-purple.png");
    }
  });

  it('preserves plugins → "/coral-logo-purple.png" (correct value, must not regress)', () => {
    expect(TIER_LOGO[PAGE_TYPE_TO_TIER["plugins"]]).toBe("/coral-logo-purple.png");
  });

  it('preserves home → "/coral-logo.png" (generic fallback, must not regress)', () => {
    expect(TIER_LOGO[PAGE_TYPE_TO_TIER["home"]]).toBe("/coral-logo.png");
  });
});

// ---------------------------------------------------------------------------
// Property 2: Per-Tier Detail Theme — no teal
// Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6
// ---------------------------------------------------------------------------

describe("DETAIL_THEMES — per-asset-type hero themes", () => {
  it("defines a theme for every AssetType", () => {
    for (const assetType of ALL_ASSET_TYPES) {
      expect(
        DETAIL_THEMES[assetType],
        `DETAIL_THEMES["${assetType}"] should be defined`,
      ).toBeDefined();
    }
  });

  it('has no "teal" in any theme property for any AssetType', () => {
    /**
     * Bug: CatalogAssetDetail applies a single hardcoded DETAIL_THEME with teal
     * colors for every asset type (the theme was designed only for "skills" but
     * was never updated when mcp_servers, plugins, connectors were added).
     *
     * Counterexample on unfixed code:
     *   CatalogAssetDetail type="mcp_servers" border → "border-teal-500/30"  ✗
     *   CatalogAssetDetail type="plugins"     border → "border-teal-500/30"  ✗
     *   CatalogAssetDetail type="connectors"  border → "border-teal-500/30"  ✗
     */
    for (const assetType of ALL_ASSET_TYPES) {
      const theme = DETAIL_THEMES[assetType];
      if (!theme) continue; // undefined already caught above

      for (const [key, value] of Object.entries(theme)) {
        expect(
          value,
          `DETAIL_THEMES["${assetType}"].${key} must not contain "teal" — got "${value}"`,
        ).not.toContain("teal");
      }
    }
  });

  it("has all required CatalogDetailTheme keys for every AssetType", () => {
    const requiredKeys = [
      "border",
      "gradient",
      "accentText",
      "accentSoft",
      "chipBorder",
      "buttonBg",
      "link",
    ];
    for (const assetType of ALL_ASSET_TYPES) {
      const theme = DETAIL_THEMES[assetType];
      if (!theme) continue;

      for (const key of requiredKeys) {
        expect(
          (theme as Record<string, string>)[key],
          `DETAIL_THEMES["${assetType}"].${key} should be defined`,
        ).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: Per-Tier Browse Link Color — no teal-400
// Validates: Requirements 6.1, 6.2, 6.3, 6.4
// ---------------------------------------------------------------------------

describe("TIER_LINK_COLOR — per-asset-type browse link colors", () => {
  it("defines a link color for every AssetType", () => {
    for (const assetType of ALL_ASSET_TYPES) {
      expect(
        TIER_LINK_COLOR[assetType],
        `TIER_LINK_COLOR["${assetType}"] should be defined`,
      ).toBeDefined();
    }
  });

  it('contains no "teal-400" in any link color class', () => {
    /**
     * Bug: HomeCatalogSection hardcodes "text-teal-400 … hover:text-teal-300"
     * for ALL asset types — the class was never updated when the per-tier color
     * system was introduced.
     *
     * Counterexample on unfixed code:
     *   HomeCatalogSection type="mcp_servers" linkClass → "text-teal-400"  ✗
     *   HomeCatalogSection type="plugins"     linkClass → "text-teal-400"  ✗
     *   HomeCatalogSection type="connectors"  linkClass → "text-teal-400"  ✗
     */
    for (const assetType of ALL_ASSET_TYPES) {
      const linkClass = TIER_LINK_COLOR[assetType];
      if (!linkClass) continue; // undefined already caught above

      expect(
        linkClass,
        `TIER_LINK_COLOR["${assetType}"] must not contain "teal-400" — got "${linkClass}"`,
      ).not.toContain("teal-400");
    }
  });
});

// ---------------------------------------------------------------------------
// Alias preservation
// ---------------------------------------------------------------------------

describe("PAGE_TYPE_TO_TIER — alias mapping preservation", () => {
  it('maps "skills" alias to "flows" tier', () => {
    expect(PAGE_TYPE_TO_TIER["skills"]).toBe("flows");
  });

  it('maps "persona" alias to "creators" tier', () => {
    expect(PAGE_TYPE_TO_TIER["persona"]).toBe("creators");
  });
});
