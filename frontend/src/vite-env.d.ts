/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "html2pdf.js" {
  interface Html2PdfWorker {
    set: (opt: Record<string, unknown>) => Html2PdfWorker
    from: (el: HTMLElement) => Html2PdfWorker
    save: () => Promise<void>
  }
  export default function html2pdf(): Html2PdfWorker
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
