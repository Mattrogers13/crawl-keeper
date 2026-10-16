import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import manifest from "../public/manifest.json";
import { buildLabel, manifestForBranch } from "./devManifest";

describe("manifestForBranch", () => {
  it("leaves main and local builds alone", () => {
    expect(manifestForBranch(manifest, "main")).toBe(manifest);
    expect(manifestForBranch(manifest, undefined)).toBe(manifest);
    expect(manifestForBranch(manifest, "")).toBe(manifest);
  });

  it("labels every other branch as Dev, within Owlbear's name limit", () => {
    const dev = manifestForBranch(manifest, "dev");
    expect(dev.name).toBe(`${manifest.name} (Dev)`);
    expect(dev.action.title).toBe(`${manifest.action.title} (Dev)`);
    expect(dev.name.length).toBeLessThanOrEqual(45);
    expect(dev.version).toBe(manifest.version);
  });

  it("gives Dev its own toolbar icon, and the file exists", () => {
    const icon = manifestForBranch(manifest, "dev").action.icon;
    expect(icon).toBe(manifest.action.icon.replace(".svg", "-dev.svg"));
    expect(existsSync(`public${icon}`)).toBe(true);
  });
});

describe("buildLabel", () => {
  it("is empty on main and local builds", () => {
    expect(buildLabel("main", "abc1234def")).toBe("");
    expect(buildLabel(undefined, undefined)).toBe("");
  });

  it("names the branch and short commit on dev builds", () => {
    expect(buildLabel("dev", "abc1234def5678")).toBe("DEV · dev · abc1234");
    expect(buildLabel("dev", undefined)).toBe("DEV · dev");
  });
});
