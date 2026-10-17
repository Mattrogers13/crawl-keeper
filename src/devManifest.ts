// Build-time only (used by vite.config.ts). Cloudflare Workers Builds sets
// WORKERS_CI_BRANCH; any branch other than main is a dev build, and gets a
// different name and toolbar icon (action-dev.svg next to the live one) so it
// can't be mistaken for the live extension in Owlbear.

export const PRODUCTION_BRANCH = "main";
export const DEV_SUFFIX = " (Dev)";

interface Manifest {
  name: string;
  action: { title: string; icon: string };
}

// "/img/action.svg" → "/img/action-dev.svg"
export const devIcon = (icon: string) => icon.replace(/(\.\w+)$/, "-dev$1");

const isDevBranch = (branch: string | undefined) => !!branch && branch !== PRODUCTION_BRANCH;

// Shown under the version in the panel footer; "" on live and local builds.
export const buildLabel = (branch: string | undefined, sha: string | undefined) =>
  isDevBranch(branch) ? ["DEV", branch, sha?.slice(0, 7)].filter(Boolean).join(" · ") : "";

export const manifestForBranch = <M extends Manifest>(manifest: M, branch: string | undefined): M =>
  !isDevBranch(branch)
    ? manifest
    : {
        ...manifest,
        name: manifest.name + DEV_SUFFIX,
        action: { ...manifest.action, title: manifest.action.title + DEV_SUFFIX, icon: devIcon(manifest.action.icon) },
      };
