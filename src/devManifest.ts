// Build-time only (used by vite.config.ts). Cloudflare Workers Builds sets
// WORKERS_CI_BRANCH; any branch other than main is a dev build, and gets a
// different name and toolbar icon (action-dev.svg next to the live one) so it
// can't be mistaken for the live extension in Owlbear. Its version carries the
// commit (0.3.0-dev.382d2f) and a branch other than dev is named, so two Dev
// installs can be told apart on Owlbear's extension cards.

export const PRODUCTION_BRANCH = "main";
export const DEV_SUFFIX = " (Dev)";

interface Manifest {
  name: string;
  version: string;
  action: { title: string; icon: string };
}

// "/img/action.svg" → "/img/action-dev.svg"
export const devIcon = (icon: string) => icon.replace(/(\.\w+)$/, "-dev$1");

const isDevBranch = (branch: string | undefined) => !!branch && branch !== PRODUCTION_BRANCH;

// Shown under the version in the panel footer; "" on live and local builds.
export const buildLabel = (branch: string | undefined, sha: string | undefined) =>
  isDevBranch(branch) ? ["DEV", branch, sha?.slice(0, 7)].filter(Boolean).join(" · ") : "";

// Owlbear's name limit.
const NAME_MAX = 45;

// "Crawl Keeper (Dev)" for dev; "Crawl Keeper (Dev: feat/x)" for any other
// branch, the branch cut to fit.
const devName = (name: string, branch: string) => {
  if (branch === "dev") return name + DEV_SUFFIX;
  const room = NAME_MAX - name.length - " (Dev: )".length;
  return `${name} (Dev: ${branch.length > room ? branch.slice(0, room - 1) + "…" : branch})`;
};

// Owlbear's version limit: a longer one fails the install ("version" length
// must be less than or equal to 16 characters long).
export const VERSION_MAX = 16;

// Semver pre-release: "0.3.0" → "0.3.0-dev.382d2f", the commit cut to fit
// VERSION_MAX and left off if under 4 characters would fit. The branch isn't
// in it (no room); the name carries it.
const devVersion = (version: string, sha: string | undefined) => {
  const base = `${version}-dev`;
  const room = Math.min(7, VERSION_MAX - base.length - 1);
  return sha && room >= 4 ? `${base}.${sha.slice(0, room)}` : base;
};

export const manifestForBranch = <M extends Manifest>(manifest: M, branch: string | undefined, sha?: string): M =>
  !isDevBranch(branch)
    ? manifest
    : {
        ...manifest,
        name: devName(manifest.name, branch!),
        version: devVersion(manifest.version, sha),
        action: { ...manifest.action, title: manifest.action.title + DEV_SUFFIX, icon: devIcon(manifest.action.icon) },
      };
