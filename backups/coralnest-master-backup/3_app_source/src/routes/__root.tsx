import {
  createRootRoute,
  HeadContent,
  Scripts,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AppProviders } from "../components/AppProviders";
import { ClientOnly } from "../components/ClientOnly";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Footer } from "../components/Footer";
import { GenericNotFoundPage } from "../components/GenericNotFoundPage";
import Header from "../components/Header";
import { getClawHubSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "../lib/site";
import { getThemeModeFromCookieHeader, normalizeThemeMode } from "../lib/themeCookie";
import designSystemCss from "../design-system.css?url";
import appCss from "../styles.css?url";

const OG_IMAGE_VERSION = "20260723-1";
export const Route = createRootRoute({
  head: () => {
    const siteName = SITE_NAME;
    const siteDescription = SITE_DESCRIPTION;
    const siteUrl = getClawHubSiteUrl();
    const ogImage = `${siteUrl}/og.png?v=${OG_IMAGE_VERSION}`;

    return {
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: siteName,
        },
        {
          name: "description",
          content: siteDescription,
        },
        {
          property: "og:site_name",
          content: siteName,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          property: "og:title",
          content: siteName,
        },
        {
          property: "og:description",
          content: siteDescription,
        },
        {
          property: "og:image",
          content: ogImage,
        },
        {
          property: "og:image:width",
          content: "1200",
        },
        {
          property: "og:image:height",
          content: "630",
        },
        {
          property: "og:image:alt",
          content: `${siteName} — ${siteDescription}`,
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: siteName,
        },
        {
          name: "twitter:description",
          content: siteDescription,
        },
        {
          name: "twitter:image",
          content: ogImage,
        },
        {
          name: "twitter:image:alt",
          content: `${siteName} — ${siteDescription}`,
        },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        {
          rel: "stylesheet",
          href: designSystemCss,
        },
        {
          rel: "icon",
          href: "/favicon-32x32.png",
          type: "image/png",
          sizes: "32x32",
        },
        {
          rel: "icon",
          href: "/favicon-16x16.png",
          type: "image/png",
          sizes: "16x16",
        },
        {
          rel: "icon",
          href: "/favicon.svg",
          type: "image/svg+xml",
        },
        {
          rel: "icon",
          href: "/favicon.ico",
          sizes: "any",
        },
        {
          rel: "apple-touch-icon",
          href: "/logo192.png",
          sizes: "192x192",
        },
        {
          rel: "manifest",
          href: "/manifest.json",
        },
      ],
    };
  },

  shellComponent: RootDocument,
  notFoundComponent: GenericNotFoundPage,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const initialThemeMode = normalizeThemeMode(
    (router.options.context as { initialThemeMode?: unknown } | undefined)?.initialThemeMode ??
      (typeof document === "undefined" ? undefined : getThemeModeFromCookieHeader(document.cookie)),
  );
  const initialResolvedTheme = initialThemeMode === "system" ? undefined : initialThemeMode;

  useEffect(() => {
    document.documentElement.dataset.clawhubHydrated = "true";
  }, []);

  const showAnalytics =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  return (
    <html
      className={initialThemeMode === "dark" ? "dark" : undefined}
      data-theme={initialResolvedTheme}
      data-theme-family="claw"
      data-theme-mode={initialThemeMode}
      data-theme-resolved={initialResolvedTheme}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        <AppProviders>
          <div className="app-shell">
            <Header />
            <RouteErrorBoundary>{children}</RouteErrorBoundary>
            <Footer />
          </div>
          <Toaster
            closeButton
            position="bottom-right"
            toastOptions={{
              classNames: {
                closeButton: "clawhub-toast-close",
              },
              style: {
                background: "var(--oc-bg-elevated)",
                color: "var(--oc-text-primary)",
                border: "1px solid var(--oc-border-subtle)",
                borderRadius: "var(--oc-radius-control)",
                fontFamily: "var(--oc-font-body)",
                paddingRight: "48px",
              },
            }}
          />
          <ClientOnly>
            {showAnalytics ? (
              <>
                <Analytics />
                <SpeedInsights />
              </>
            ) : null}
          </ClientOnly>
        </AppProviders>
        <Scripts />
      </body>
    </html>
  );
}

/** Resets the error boundary whenever the route pathname changes. */
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}
