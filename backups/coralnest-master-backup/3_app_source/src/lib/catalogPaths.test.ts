import { describe, expect, it } from "vitest";
import { catalogBrowseHref, catalogDetailHref } from "./catalogPaths";

describe("catalogDetailHref", () => {
  it.each([
    ["skills", "/skills/some-slug"],
    ["loops", "/loops/some-slug"],
    ["graphs", "/graphs/some-slug"],
    ["mcp_servers", "/mcp/some-slug"],
    ["connectors", "/connectors/some-slug"],
    ["plugins", "/plugins/catalog/some-slug"],
  ] as const)("maps %s to a detail route", (type, expected) => {
    expect(catalogDetailHref(type, "some-slug")).toBe(expected);
  });

  it("encodes slug segments", () => {
    expect(catalogDetailHref("skills", "a/b")).toBe("/skills/a%2Fb");
  });

  it("throws for an unknown asset type", () => {
    expect(() => catalogDetailHref("unknown" as never, "x")).toThrow("Unhandled asset type");
  });
});

describe("catalogBrowseHref", () => {
  it.each([
    ["skills", "/flows?tab=skills"],
    ["loops", "/flows?tab=loops"],
    ["graphs", "/flows?tab=graphs"],
    ["mcp_servers", "/mcp"],
    ["connectors", "/connectors"],
    ["plugins", "/plugins"],
  ] as const)("maps %s to a browse route", (type, expected) => {
    expect(catalogBrowseHref(type)).toBe(expected);
  });

  it("throws for an unknown asset type", () => {
    expect(() => catalogBrowseHref("unknown" as never)).toThrow("Unhandled asset type");
  });
});
