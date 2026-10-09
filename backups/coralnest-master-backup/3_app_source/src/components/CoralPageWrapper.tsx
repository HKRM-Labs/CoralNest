import { type ReactNode } from "react";
import { PAGE_TYPE_TO_TIER, TIER_LOGO } from "../lib/tierTheme";

interface CoralPageWrapperProps {
  children: ReactNode;
  pageType?: "skills" | "flows" | "plugins" | "connectors" | "creators" | "mcp" | "home";
  className?: string;
}

export function CoralPageWrapper({
  children,
  pageType = "home",
  className = "",
}: CoralPageWrapperProps) {
  const logoSrc = getCoralLogoSrc(pageType);
  const pageTitle = getPageTitle(pageType);

  return (
    <div className={`coral-page-wrapper ${className}`} data-coral-page={pageType}>
      {/* Real Coral Top Background Banner (covering ~1/3 top height with bottom fade) */}
      <div className="coral-header-bg" aria-hidden="true" />

      {/* Centered Colored Logo + Page Title banner for section pages */}
      {pageType !== "home" && (
        <div className="coral-section-header">
          <div className="coral-section-header-inner">
            <img src={logoSrc} alt={pageTitle} className="coral-section-logo" />
            <span className="coral-section-title">{pageTitle}</span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

function getCoralLogoSrc(pageType: string): string {
  const tier = PAGE_TYPE_TO_TIER[pageType] ?? "home";
  return TIER_LOGO[tier];
}

function getPageTitle(pageType: string): string {
  switch (pageType) {
    case "skills":
      return "Skills";
    case "flows":
      return "Flows";
    case "plugins":
      return "Plugins";
    case "connectors":
      return "Connectors";
    case "creators":
      return "Personas";
    case "mcp":
      return "MCP Servers";
    default:
      return "CoralNest";
  }
}
