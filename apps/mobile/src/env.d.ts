/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 与 **`apps/mobile/.env.example`** 一致：服务端 **`/api/v1`** 所在源（无尾斜杠）。 */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
