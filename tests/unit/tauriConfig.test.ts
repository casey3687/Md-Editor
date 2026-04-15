import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type TauriConf = {
  app?: {
    security?: {
      assetProtocol?: {
        enable?: boolean;
        scope?: string[];
      };
    };
  };
};

describe("tauri image protocol config", () => {
  it("enables asset protocol for local image rendering", () => {
    const configPath = resolve(process.cwd(), "src-tauri", "tauri.conf.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as TauriConf;
    const assetProtocol = config.app?.security?.assetProtocol;

    expect(assetProtocol?.enable).toBe(true);
    expect(assetProtocol?.scope).toEqual(expect.arrayContaining(["**"]));
  });
});
