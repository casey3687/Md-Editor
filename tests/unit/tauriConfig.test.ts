import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type TauriConf = {
  app?: {
    windows?: Array<{
      label?: string;
      visible?: boolean;
    }>;
    security?: {
      assetProtocol?: {
        enable?: boolean;
        scope?: string[];
      };
    };
  };
};

type TauriCapability = {
  permissions?: string[];
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

describe("tauri window theme capability", () => {
  it("allows the frontend to sync native window appearance", () => {
    const capabilityPath = resolve(process.cwd(), "src-tauri", "capabilities", "default.json");
    const capability = JSON.parse(readFileSync(capabilityPath, "utf-8")) as TauriCapability;

    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        "core:window:allow-set-theme",
        "core:window:allow-set-title",
        "core:window:allow-show",
      ]),
    );
  });

  it("keeps the main window hidden until its saved appearance is applied", () => {
    const configPath = resolve(process.cwd(), "src-tauri", "tauri.conf.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as TauriConf;
    const mainWindow = config.app?.windows?.find((window) => window.label === "main");

    expect(mainWindow?.visible).toBe(false);
  });
});
