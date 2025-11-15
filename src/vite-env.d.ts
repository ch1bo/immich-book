/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMMICH_PROXY_TARGET?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
