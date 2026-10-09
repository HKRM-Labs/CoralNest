export type PublisherOgMeta = {
  handle: string | null;
  kind: "user" | "org";
  official: boolean;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  affiliations: Array<{
    handle: string;
    displayName: string;
    image: string | null;
  }>;
  stats: {
    downloads: number;
  };
};

export async function fetchPublisherOgMeta(
  handle: string,
  apiBase: string,
): Promise<PublisherOgMeta | null> {
  try {
    const url = new URL(`/api/v1/publishers/${encodeURIComponent(handle)}`, apiBase);
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const profile = (await response.json()) as {
      handle?: string;
      kind?: "user" | "org";
      official?: boolean;
      displayName?: string;
      bio?: string;
      image?: string;
      affiliations?: Array<{ handle?: string; displayName?: string; image?: string }>;
      stats?: { downloads?: number };
    };
    if (!profile) return null;
    return {
      handle: profile.handle ?? null,
      kind: profile.kind === "org" ? "org" : "user",
      official: profile.official === true,
      displayName: profile.displayName ?? null,
      bio: profile.bio ?? null,
      image: profile.image ?? null,
      affiliations: (profile.affiliations ?? []).map((a) => ({
        handle: a.handle ?? "",
        displayName: a.displayName ?? "",
        image: a.image ?? null,
      })),
      stats: {
        downloads: profile.stats?.downloads ?? 0,
      },
    };
  } catch {
    return null;
  }
}
