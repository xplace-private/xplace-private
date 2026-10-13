/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_CROWDIN_DISTRIBUTION_HASH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
