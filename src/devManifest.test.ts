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
  });

  it("puts the commit in the version, so two Dev installs differ on their cards", () => {
    expect(manifestForBranch(manifest, "dev", "382d2fb9abc").version).toBe(`${manifest.version}-dev.382d2fb`);
    expect(manifestForBranch(manifest, "dev").version).toBe(`${manifest.version}-dev`);
    expect(manifestForBranch(manifest, "feat/scene-size-test", "abc1234ff").version).toBe(`${manifest.version}-feat-scene-size-test.abc1234`);
  });

  it("names any branch other than dev, cut to Owlbear's name limit", () => {
    expect(manifestForBranch(manifest, "torchlight-merge").name).toBe(`${manifest.name} (Dev: torchlight-merge)`);
    const long = manifestForBranch(manifest, "feat/a-really-long-branch-name-for-testing").name;
    expect(long.length).toBe(45);
    expect(long).toMatch(/^Crawl Keeper \(Dev: feat\/a-really-.*…\)$/);
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
