/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.fn();
const initWasmMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

vi.mock("@resvg/resvg-wasm", () => ({
  initWasm: (...args: unknown[]) => initWasmMock(...args),
}));

describe("ogAssets", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __nitro_main__?: unknown }).__nitro_main__;
    readFileMock.mockReset();
    initWasmMock.mockReset();
  });

  it("loads the packaged local OG watermark asset", async () => {
    readFileMock.mockImplementation(async (input: unknown) => {
      const path = String(input);
      if (path.includes("public/og-coral-watermark.png")) {
        return Buffer.from("watermark");
      }
      if (path.includes("og-coral-watermark.png")) {
        throw new Error("missing root watermark");
      }
      throw new Error(`unexpected read: ${path}`);
    });

    const { getWatermarkDataUrl } = await import("./ogAssets");

    await expect(getWatermarkDataUrl()).resolves.toBe("data:image/png;base64,d2F0ZXJtYXJr");
    expect(readFileMock).toHaveBeenCalledTimes(2);
    expect(String(readFileMock.mock.calls[0]?.[0])).toContain("og-coral-watermark.png");
    expect(String(readFileMock.mock.calls[1]?.[0])).toContain("public/og-coral-watermark.png");
  });

  it("falls back to the packaged public site logo asset", async () => {
    readFileMock.mockImplementation(async (input: unknown) => {
      const path = String(input);
      if (path.includes("public/coral-logo.png")) {
        return Buffer.from("png");
      }
      if (path.includes("coral-logo.png")) {
        throw new Error("missing root mark");
      }
      throw new Error(`unexpected read: ${path}`);
    });

    const { getMarkDataUrl } = await import("./ogAssets");

    await expect(getMarkDataUrl()).resolves.toBe("data:image/png;base64,cG5n");
    expect(readFileMock).toHaveBeenCalledTimes(2);
    expect(String(readFileMock.mock.calls[0]?.[0])).toContain("coral-logo.png");
    expect(String(readFileMock.mock.calls[1]?.[0])).toContain("public/coral-logo.png");
  });

  it("loads the fixed CoralNest logo from coral-logo.png", async () => {
    readFileMock.mockImplementation(async (input: unknown) => {
      const path = String(input);
      if (path.includes("public/coral-logo.png")) {
        return Buffer.from("coral-logo");
      }
      if (path.endsWith("coral-logo.png")) {
        throw new Error("missing root logo");
      }
      throw new Error(`unexpected read: ${path}`);
    });

    const { getCoralLogoDataUrl } = await import("./ogAssets");

    await expect(getCoralLogoDataUrl()).resolves.toBe("data:image/png;base64,Y29yYWwtbG9nbw==");
    expect(readFileMock).toHaveBeenCalledTimes(2);
    expect(String(readFileMock.mock.calls[0]?.[0])).toContain("coral-logo.png");
    expect(String(readFileMock.mock.calls[1]?.[0])).toContain("public/coral-logo.png");
  });

  it("initializes resvg wasm only once per process", async () => {
    readFileMock.mockImplementation(async (input: unknown) => {
      const path = String(input);
      if (path.includes("index_bg.wasm")) {
        return Buffer.from([1, 2, 3]);
      }
      throw new Error(`unexpected read: ${path}`);
    });
    initWasmMock.mockResolvedValue(undefined);

    const { ensureResvgWasm } = await import("./ogAssets");

    await ensureResvgWasm();
    await ensureResvgWasm();

    expect(initWasmMock).toHaveBeenCalledTimes(1);
    expect(initWasmMock).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(String(readFileMock.mock.calls[0]?.[0])).toContain("index_bg.wasm");
  });

  it("caches font buffers across calls", async () => {
    readFileMock.mockResolvedValue(Buffer.from([9, 8, 7]));

    const { getFontBuffers } = await import("./ogAssets");

    const first = await getFontBuffers();
    const second = await getFontBuffers();

    expect(first).toHaveLength(6);
    expect(first[0]).toBeInstanceOf(Uint8Array);
    expect(second).toEqual(first);
    expect(readFileMock).toHaveBeenCalledTimes(6);
    expect(readFileMock.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("bricolage-grotesque-latin-800-normal.woff2"),
        expect.stringContaining("bricolage-grotesque-latin-700-normal.woff2"),
        expect.stringContaining("bricolage-grotesque-latin-500-normal.woff2"),
        expect.stringContaining("ibm-plex-mono-latin-500-normal.woff2"),
        expect.stringContaining("noto-sans-sc-chinese-simplified-800-normal.woff2"),
        expect.stringContaining("noto-sans-sc-chinese-simplified-500-normal.woff2"),
      ]),
    );
  });

  it("loads publisher fonts with Bricolage 700 first", async () => {
    readFileMock.mockResolvedValue(Buffer.from([9, 8, 7]));

    const { getPublisherFontBuffers } = await import("./ogAssets");

    const first = await getPublisherFontBuffers();
    const second = await getPublisherFontBuffers();

    expect(first).toHaveLength(6);
    expect(second).toEqual(first);
    expect(readFileMock).toHaveBeenCalledTimes(6);
    expect(String(readFileMock.mock.calls[0]?.[0])).toContain(
      "bricolage-grotesque-latin-700-normal.woff2",
    );
    expect(String(readFileMock.mock.calls[1]?.[0])).toContain(
      "bricolage-grotesque-latin-800-normal.woff2",
    );
  });
});
