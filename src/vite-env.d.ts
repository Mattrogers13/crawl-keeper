/// <reference types="vite/client" />

interface ImportMetaEnv {
  // "DEV · <branch> · <sha>" on non-main Cloudflare builds, "" otherwise (vite.config.ts).
  readonly VITE_BUILD_LABEL: string;
}
