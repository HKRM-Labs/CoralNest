import { createFileRoute } from "@tanstack/react-router";
import { CoralPageWrapper } from "../../components/CoralPageWrapper";
import { SITE_NAME } from "../../lib/site";

export const Route = createFileRoute("/persona/")({
  head: () => ({
    meta: [{ title: `Personas — ${SITE_NAME}` }],
  }),
  component: PersonaIndex,
});

function PersonaIndex() {
  return (
    <CoralPageWrapper pageType="creators">
      <main className="browse-page browse-page-borderless-header">
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <img
            src="/coral-logo-pink.png"
            alt="Personas"
            className="h-20 w-20 rounded-2xl"
            draggable={false}
          />
          <h1 className="browse-title text-3xl font-extrabold">Personas</h1>
          <p className="browse-subtitle mx-auto max-w-lg text-base">
            Complete agent archetypes with pre-wired Flows, MCP Servers, and Connectors. The full
            specialist you hire — packaged and ready.
          </p>
          <p className="text-sm font-semibold text-pink-400">Coming Soon</p>
        </div>
      </main>
    </CoralPageWrapper>
  );
}
