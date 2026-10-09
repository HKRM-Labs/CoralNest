/* @vitest-environment node */

import { describe, expect, it, vi } from "vitest";
import { fetchPublisherOgMeta } from "./fetchPublisherOgMeta";

describe("fetchPublisherOgMeta", () => {
  it("fetches publisher meta via HTTP API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        handle: "openclaw",
        kind: "org",
        displayName: "OpenClaw",
        bio: "Build with claws.",
        image: null,
        official: true,
        affiliations: [
          { handle: "github", displayName: "GitHub", image: "https://example.com/github.png" },
        ],
        stats: { downloads: 99 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const meta = await fetchPublisherOgMeta("openclaw", "https://api.example.com");

    expect(meta?.stats.downloads).toBe(99);
    expect(meta?.official).toBe(true);
    expect(meta?.affiliations).toEqual([
      { handle: "github", displayName: "GitHub", image: "https://example.com/github.png" },
    ]);

    vi.unstubAllGlobals();
  });
});
