import { describe, it, expect } from "vitest";
import manifest from "../public/manifest.json";
import pkg from "../package.json";

// Owlbear Rodeo rejects the install if these are exceeded.
describe("manifest.json", () => {
  it("fits Owlbear Rodeo's field limits", () => {
    expect(manifest.name.length).toBeLessThanOrEqual(45);
    expect(manifest.description.length).toBeLessThanOrEqual(128);
  });

  it("has the fields Owlbear Rodeo needs to load the extension", () => {
    expect(manifest.manifest_version).toBe(1);
    expect(manifest.version).toBeTruthy();
    expect(manifest.action.popover).toBe("/");
  });

  it("has the same version as package.json", () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it("uses no SVG for the manifest icon (shown in the extension list)", () => {
    expect(manifest.icon).not.toMatch(/\.svg$/);
  });
});
