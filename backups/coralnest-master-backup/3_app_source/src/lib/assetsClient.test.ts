/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assetDownloadUrl,
  assetFileUrl,
  assetPayloadUrl,
  getAssetCountsClient,
  getAssetDetailClient,
  getAssetFilterOptionsClient,
  parsePayloadJson,
  rowBool,
  rowNumber,
  rowString,
  rowStringArray,
  searchAssetsClient,
} from "./assetsClient";
import type { AssetRow } from "./assetTypes";

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 404,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchAssetsClient", () => {
  it("builds the search URL from every param", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ type: "skills", items: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchAssetsClient({
      type: "skills",
      query: "slack",
      category: "chat",
      framework: "langchain",
      transport: "streamable-http",
      sortBy: "downloads",
      limit: 10,
      offset: 20,
    });

    expect(result).toEqual({ type: "skills", items: [], total: 0 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/v1/assets/search");
    expect(url.searchParams.get("type")).toBe("skills");
    expect(url.searchParams.get("query")).toBe("slack");
    expect(url.searchParams.get("category")).toBe("chat");
    expect(url.searchParams.get("framework")).toBe("langchain");
    expect(url.searchParams.get("transport")).toBe("streamable-http");
    expect(url.searchParams.get("sortBy")).toBe("downloads");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("offset")).toBe("20");
  });

  it("omits empty params and forwards the abort signal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ type: "skills", items: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await searchAssetsClient({}, controller.signal);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.size).toBe(0);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("returns null on non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, false)));
    await expect(searchAssetsClient({})).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(searchAssetsClient({})).resolves.toBeNull();
  });
});

describe("single-asset client fetchers", () => {
  it("getAssetDetailClient returns parsed data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAssetDetailClient("skills", "foo");

    expect(result).toEqual({ ok: true });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/v1/assets/detail");
    expect(url.searchParams.toString()).toBe("type=skills&slug=foo");
  });

  it("getAssetFilterOptionsClient returns filter options", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAssetFilterOptionsClient("skills");

    expect(result).toEqual({ ok: true });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/v1/assets/filters");
    expect(url.searchParams.toString()).toBe("type=skills");
  });

  it("returns null on non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, false)));
    await expect(getAssetDetailClient("skills", "foo")).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(getAssetDetailClient("skills", "foo")).resolves.toBeNull();
  });
});

describe("getAssetCountsClient", () => {
  it("returns counts on success", async () => {
    const body = { skills: 1, loops: 2, graphs: 3, mcp_servers: 4, connectors: 5, plugins: 6 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body)));
    await expect(getAssetCountsClient()).resolves.toEqual(body);
  });

  it("returns null on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(getAssetCountsClient()).resolves.toBeNull();
  });
});

describe("asset URL helpers", () => {
  it("builds file, download, and payload URLs with encoding", () => {
    expect(assetFileUrl("skills", "a/b", "src/main.ts")).toBe(
      "/api/v1/assets/file?type=skills&slug=a%2Fb&path=src%2Fmain.ts",
    );
    expect(assetDownloadUrl("mcp_servers", "x y")).toBe(
      "/api/v1/assets/download?type=mcp_servers&slug=x%20y",
    );
    expect(assetPayloadUrl("plugins", "p")).toBe("/api/v1/assets/payload?type=plugins&slug=p");
  });
});

describe("row accessors", () => {
  const row: AssetRow = {
    name: "demo",
    downloads: 7,
    secure: true,
    tags: ["a", "b"],
    empty: "",
    zero: 0,
  };

  it("rowString returns non-empty strings only", () => {
    expect(rowString(row, "name")).toBe("demo");
    expect(rowString(row, "empty")).toBeUndefined();
    expect(rowString(row, "missing")).toBeUndefined();
  });

  it("rowNumber returns numbers only", () => {
    expect(rowNumber(row, "downloads")).toBe(7);
    expect(rowNumber(row, "zero")).toBe(0);
    expect(rowNumber(row, "name")).toBeUndefined();
  });

  it("rowBool returns booleans only", () => {
    expect(rowBool(row, "secure")).toBe(true);
    expect(rowBool(row, "name")).toBeUndefined();
  });

  it("rowStringArray filters to strings or wraps a single string", () => {
    expect(rowStringArray(row, "tags")).toEqual(["a", "b"]);
    expect(rowStringArray(row, "name")).toEqual(["demo"]);
    expect(rowStringArray(row, "empty")).toEqual([]);
    expect(rowStringArray(row, "missing")).toEqual([]);
  });
});

describe("parsePayloadJson", () => {
  it("returns null for null payloads", () => {
    expect(parsePayloadJson(null)).toBeNull();
  });

  it("parses valid JSON content", () => {
    expect(
      parsePayloadJson({
        content: '{"a":1}',
        fileName: "a.json",
        contentType: "json",
        storagePath: "p",
      }),
    ).toEqual({ a: 1 });
  });

  it("returns null for invalid JSON content", () => {
    expect(
      parsePayloadJson({
        content: "{nope",
        fileName: "a.json",
        contentType: "json",
        storagePath: "p",
      }),
    ).toBeNull();
  });
});
